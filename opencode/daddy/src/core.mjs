const TIERS = ["high", "mid", "low"];
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const NODE_KINDS = {
  intent: "llm", "spec-design": "llm", plan: "llm", build: "parallel",
  verify: "shell", "issue-rca": "llm", "issue-plan": "llm",
  "issue-build": "parallel", "issue-verify": "shell", ship: "shell",
};
const NODE_OUTCOMES = {
  intent: ["sdlc", "issue", "blocked"], "spec-design": ["success", "blocked"],
  plan: ["success", "blocked"], build: ["success", "failure", "blocked"],
  verify: ["success", "failure", "blocked"], "issue-rca": ["success", "blocked"],
  "issue-plan": ["success", "blocked"], "issue-build": ["success", "failure", "blocked"],
  "issue-verify": ["success", "failure", "max-depth", "blocked"], ship: ["delivered", "blocked"],
};
const MODEL_NODES = {intent: "intent", "spec-design": "spec_design", plan: "plan", "issue-rca": "rca", "issue-plan": "issue_plan"};
const ITEM_ARRAYS = [
  "depends_on",
  "acceptance_criteria",
  "affected_paths",
  "validation_commands",
];
const PROSE_COMMAND = /^(?:run|inspect|manually|verify|apply|register|select|open|check)(?:\s|$)/i;
const LONG_RUNNING_COMMAND = /(?:^|[;&|]\s*)(?:bun|npm|pnpm|yarn)\s+(?:run\s+)?(?:dev|start|serve)(?:\s|$)|(?:^|\s)--watch(?:[=\s]|$)/i;

const fail = (message) => {
  throw new Error(message);
};

const object = (value, name) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
};

const positiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 1) {
    fail(`${name} must be a positive integer`);
  }
};

const validationCommand = (value, name) => {
  if (typeof value !== "string" || !value.trim() || /[\0\r\n]/.test(value)) fail(`${name} must be a single-line shell command`);
  const command = value.trim();
  if (PROSE_COMMAND.test(command)) fail(`${name} must be executable shell, not prose or a manual instruction`);
  if (LONG_RUNNING_COMMAND.test(command)) fail(`${name} must not start a dev, watch, or server process`);
};

export function validateConfig(config) {
  object(config, "config");
  if (config.version !== 1) fail("config.version must be 1");
  object(config.runtime, "config.runtime");
  object(config.build, "config.build");
  object(config.provisioning, "config.provisioning");
  object(config.models, "config.models");
  object(config.nodes, "config.nodes");
  if (JSON.stringify(Object.keys(config.provisioning).sort()) !== JSON.stringify(["copy_env_files"])) fail("config.provisioning must contain exactly copy_env_files");
  if (typeof config.provisioning.copy_env_files !== "boolean") fail("config.provisioning.copy_env_files must be a boolean");
  positiveInteger(config.runtime.max_issue_depth, "runtime.max_issue_depth");
  positiveInteger(config.runtime.command_timeout_seconds, "runtime.command_timeout_seconds");
  if (!Number.isInteger(config.runtime.node_retries) || config.runtime.node_retries < 0) {
    fail("runtime.node_retries must be a non-negative integer");
  }
  positiveInteger(config.build.max_concurrency, "build.max_concurrency");
  positiveInteger(config.build.max_items, "build.max_items");

  for (const [key, model] of Object.entries(config.models)) {
    if (!MODEL_PATTERN.test(model)) fail(`models.${key} must be a safe provider/model identifier`);
  }
  for (const [node, modelKey] of Object.entries(MODEL_NODES)) {
    if (typeof config.models[modelKey] !== "string") fail(`models.${modelKey} is required by nodes.${node}`);
  }
  const declared = new Set(Object.keys(config.nodes));
  for (const [node, definition] of Object.entries(config.nodes)) {
    object(definition, `nodes.${node}`);
    object(definition.outcomes, `nodes.${node}.outcomes`);
    for (const [outcome, target] of Object.entries(definition.outcomes)) {
      if (!outcome || ![...declared, "halt", "delivered"].includes(target)) fail(`nodes.${node}.outcomes has an invalid edge`);
    }
  }
  for (const [node, kind] of Object.entries(NODE_KINDS)) {
    object(config.nodes[node], `nodes.${node}`);
    if (config.nodes[node].kind !== kind) fail(`nodes.${node}.kind must be ${kind}`);
    if (JSON.stringify(Object.keys(config.nodes[node].outcomes).sort()) !== JSON.stringify([...NODE_OUTCOMES[node]].sort())) fail(`nodes.${node}.outcomes must declare exactly the supported outcomes`);
  }
  for (const node of ["build", "issue-build"]) {
    object(config.nodes[node].model_by_complexity, `nodes.${node}.model_by_complexity`);
    for (const tier of TIERS) {
      const modelKey = config.nodes[node].model_by_complexity[tier];
      if (typeof modelKey !== "string" || typeof config.models[modelKey] !== "string" || !config.models[modelKey]) {
        fail(`nodes.${node}.model_by_complexity.${tier} must reference a configured model`);
      }
    }
  }
  return config;
}

export function resolveTransition(config, node, outcome) {
  const target = config.nodes[node]?.outcomes?.[outcome];
  if (typeof target !== "string") fail(`nodes.${node} has no transition for outcome ${outcome}`);
  return target;
}

export function validatePlan(plan, config) {
  object(plan, "plan");
  if (!Array.isArray(plan.items) || plan.items.length === 0) {
    fail("plan.items must be a non-empty array");
  }
  if (!Array.isArray(plan.final_validation_commands) || plan.final_validation_commands.length === 0) {
    fail("plan.final_validation_commands must be a non-empty array");
  }
  for (const command of plan.final_validation_commands) validationCommand(command, "plan.final_validation_commands");
  if (plan.items.length > config.build.max_items) fail("plan exceeds build.max_items");

  const byId = new Map();
  for (const item of plan.items) {
    object(item, "plan item");
    const expectedKeys = [...ITEM_ARRAYS, "id", "title", "objective", "complexity"].sort();
    if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(expectedKeys)) fail(`item ${item.id ?? "<unknown>"} has unknown or missing fields`);
    if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(item.id)) {
      fail("plan item has invalid id");
    }
    if (byId.has(item.id)) fail(`duplicate item id: ${item.id}`);
    if (!TIERS.includes(item.complexity)) fail(`unknown complexity tier: ${item.complexity}`);
    for (const key of ITEM_ARRAYS) {
      if (!Array.isArray(item[key])) fail(`item ${item.id}.${key} must be an array`);
    }
    for (const affectedPath of item.affected_paths) {
      if (typeof affectedPath !== "string" || !affectedPath || affectedPath.startsWith("/") || affectedPath.split(/[\\/]/).includes("..")) fail(`item ${item.id}.affected_paths contains an unsafe path`);
    }
    if (item.acceptance_criteria.length === 0 || item.affected_paths.length === 0 || item.validation_commands.length === 0) {
      fail(`item ${item.id} requires acceptance_criteria, affected_paths, and validation_commands`);
    }
    for (const command of item.validation_commands) validationCommand(command, `item ${item.id}.validation_commands`);
    byId.set(item.id, item);
  }

  for (const item of plan.items) {
    const dependencies = new Set();
    for (const dependency of item.depends_on) {
      if (dependency === item.id) fail(`item ${item.id} cannot depend on itself`);
      if (!byId.has(dependency)) fail(`item ${item.id} has unknown dependency: ${dependency}`);
      if (dependencies.has(dependency)) fail(`item ${item.id} has duplicate dependency: ${dependency}`);
      dependencies.add(dependency);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) fail(`dependency cycle includes: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return plan;
}

export function readyItems(items, statuses) {
  return items
    .filter((item) => statuses[item.id] === "pending"
      && item.depends_on.every((id) => statuses[id] === "integrated"))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function runBuild({plan, config, depth, adapter, record, request, context}) {
  validatePlan(plan, config);
  const emit = record ?? (() => {});
  const statuses = Object.fromEntries(plan.items.map((item) => [item.id, "pending"]));
  const running = new Map();
  const node = depth > 0 ? "issue-build" : "build";
  const retries = config.runtime.node_retries;
  let terminal;
  let integration = Promise.resolve();

  const execute = async (item) => {
    statuses[item.id] = "running";
    const modelKey = config.nodes[node].model_by_complexity[item.complexity];
    const model = config.models[modelKey];
    emit({type: "worker-started", item_id: item.id, depth, model});
    let worker;
    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      try {
        worker = await adapter.runWorker({item, model, depth, attempt, request, context});
        break;
      } catch (error) {
        emit({type: "worker-exception", item_id: item.id, depth, attempt, error});
        if (attempt > retries) {
          statuses[item.id] = "blocked";
          return {outcome: "blocked", item, reason: `worker ${item.id} infrastructure retries exhausted`, error};
        }
      }
    }
    if (!worker || worker.outcome !== "success") {
      statuses[item.id] = worker?.outcome === "blocked" ? "blocked" : "failed";
      return {
        outcome: worker?.outcome === "blocked" ? "blocked" : "failure",
        item,
        reason: `worker ${item.id} ${worker?.outcome ?? "failed"}`,
        worker,
      };
    }

    const integrate = async () => {
      const result = await adapter.integrate({item, worker, depth});
      if (result?.outcome === "success") {
        statuses[item.id] = "integrated";
        emit({type: "item-integrated", item_id: item.id, depth});
        return {outcome: "success", item, worker, integration: result};
      }
      statuses[item.id] = result?.outcome === "blocked" ? "blocked" : "failed";
      return {
        outcome: result?.outcome === "blocked" ? "blocked" : "failure",
        item,
        reason: `integration ${item.id} ${result?.outcome ?? "failed"}`,
        integration: result,
      };
    };
    const joined = integration.then(integrate);
    integration = joined.catch(() => {});
    try {
      return await joined;
    } catch (error) {
      statuses[item.id] = "blocked";
      return {outcome: "blocked", item, reason: `integration ${item.id} infrastructure exception`, error};
    }
  };

  while (true) {
    if (!terminal) {
      for (const item of readyItems(plan.items, statuses)) {
        if (running.size >= config.build.max_concurrency) break;
        const promise = execute(item).then((result) => ({id: item.id, result}));
        running.set(item.id, promise);
      }
    }
    if (running.size === 0) break;
    const {id, result} = await Promise.race(running.values());
    running.delete(id);
    if (result.outcome !== "success" && !terminal) {
      terminal = result;
      emit({type: "build-stopped", item_id: id, depth, outcome: result.outcome, reason: result.reason});
    }
  }
  if (terminal) return terminal;
  return {outcome: "success", statuses};
}

// Adapter methods receive one object so infrastructure implementations can add
// context without coupling this pure controller to filesystem or process APIs.
// Lifecycle: preflight({config, request}), createWorkspace({config, request,
// preflight}), and cleanup({config, request, workspace}). Execution:
// runNode({node, input, depth, ...}), runWorker({item, model, depth, attempt}),
// integrate({item, worker, depth}), and verify({plan, build, route, depth, ...}).
// Terminal calls are ship({...}) and halt({reason, node, depth, context, ...}).
export async function runDag({config, request, adapter, record}) {
  const emit = record ?? (() => {});
  let workspace;
  try {
    validateConfig(config);
    const halt = (reason, node, depth, context) => {
      emit({type: "halted", reason, node, depth});
      return adapter.halt({reason, node, depth, context, config, request, workspace});
    };
    const blockedHalt = async (node, depth, value, reason) => {
      const target = resolveTransition(config, node, "blocked");
      return await halt(target === "halt" ? reason : `unsupported configured transition: ${node}.blocked -> ${target}`, node, depth, value);
    };
    const preflight = await adapter.preflight({config, request});
    if (preflight?.status === "blocked" || preflight?.outcome === "blocked") {
      return await halt("preflight blocked", "preflight", 0, preflight);
    }
    workspace = await adapter.createWorkspace({config, request, preflight});
    emit({type: "workspace-created"});
    if (workspace?.status === "blocked") return await halt(`integration provisioning infrastructure blocked: ${workspace.reason}`, "preflight", 0, workspace.provisioning);

    const runNode = async (node, input, depth) => {
      try {
        const result = await adapter.runNode({node, input: {request, context: input}, depth, config, request, workspace});
        emit({type: "node-completed", node, depth, outcome: result?.outcome});
        return result;
      } catch (error) {
        return {outcome: "blocked", error, reason: `${node} infrastructure exception`};
      }
    };

    const intent = await runNode("intent", {request, preflight}, 0);
    if (intent?.outcome === "blocked") return await blockedHalt("intent", 0, intent, intent.reason ?? "intent blocked");
    if (intent?.outcome !== "sdlc" && intent?.outcome !== "issue") {
      return await halt("intent returned invalid outcome", "intent", 0, intent);
    }

    const target = resolveTransition(config, "intent", intent.outcome);
    const expectedIntentTarget = intent.outcome === "sdlc" ? "spec-design" : "issue-rca";
    if (target === "halt") return await halt("configured transition intent -> halt", "intent", 0, intent);
    if (target !== expectedIntentTarget) return await halt(`unsupported configured transition: intent.${intent.outcome} -> ${target}`, "intent", 0, intent);
    let route = intent.outcome;
    let depth = route === "issue" ? 1 : 0;
    let context = {history: [preflight, intent]};
    let baselineCommands;
    const issueCommands = [];
    const transition = async (node, outcome, expected, nodeDepth, value) => {
      const next = resolveTransition(config, node, outcome);
      if (next === "halt") return await halt(`configured transition ${node} -> halt`, node, nodeDepth, value);
      if (!expected.includes(next)) return await halt(`unsupported configured transition: ${node}.${outcome} -> ${next}`, node, nodeDepth, value);
      return next;
    };
    while (true) {
      let plan;
      if (route === "sdlc") {
        const spec = await runNode("spec-design", context, 0);
        if (spec?.outcome !== "success") return await blockedHalt("spec-design", 0, spec, spec?.reason ?? "spec-design blocked");
        const specNext = await transition("spec-design", spec.outcome, ["plan"], 0, spec);
        if (typeof specNext !== "string") return specNext;
        context = {history: [...context.history, spec]};
        plan = await runNode("plan", context, 0);
        if (plan?.outcome !== "success") return await blockedHalt("plan", 0, plan, plan?.reason ?? "plan blocked");
        const planNext = await transition("plan", plan.outcome, ["build"], 0, plan);
        if (typeof planNext !== "string") return planNext;
      } else {
        const rca = await runNode("issue-rca", context, depth);
        if (rca?.outcome !== "success") return await blockedHalt("issue-rca", depth, rca, rca?.reason ?? "issue-rca blocked");
        const rcaNext = await transition("issue-rca", rca.outcome, ["issue-plan"], depth, rca);
        if (typeof rcaNext !== "string") return rcaNext;
        context = {history: [...context.history, rca]};
        plan = await runNode("issue-plan", context, depth);
        if (plan?.outcome !== "success") return await blockedHalt("issue-plan", depth, plan, plan?.reason ?? "issue-plan blocked");
        const issuePlanNext = await transition("issue-plan", plan.outcome, ["issue-build"], depth, plan);
        if (typeof issuePlanNext !== "string") return issuePlanNext;
      }

      try {
        validatePlan(plan, config);
      } catch (error) {
        return await halt(`invalid ${route} plan: ${error.message}`, route === "sdlc" ? "plan" : "issue-plan", depth, error);
      }
      if (!baselineCommands && route === "sdlc") baselineCommands = [...plan.final_validation_commands];
      if (!baselineCommands) baselineCommands = [...plan.final_validation_commands];
      else if (route === "issue") issueCommands.push(...plan.final_validation_commands);
      const validationCommands = [...new Set([...baselineCommands, ...issueCommands])];
      context = {history: [...context.history, plan]};
      const build = await runBuild({plan, config, depth, adapter, record: emit, request, context});
      const buildNode = depth ? "issue-build" : "build";
      if (build.outcome === "blocked") return await blockedHalt(buildNode, depth, build, build.reason);
      if (build.outcome === "failure") {
        const next = await transition(buildNode, "failure", ["issue-rca"], depth, build);
        if (typeof next !== "string") return next;
        context = {history: [...context.history, build]};
      } else {
        const buildNext = await transition(buildNode, "success", [depth ? "issue-verify" : "verify"], depth, build);
        if (typeof buildNext !== "string") return buildNext;
        let verification;
        try {
          verification = await adapter.verify({plan, build, route, depth, config, request, workspace, validationCommands});
          emit({type: "verification-completed", route, depth, outcome: verification?.outcome});
        } catch (error) {
          return await halt("verify infrastructure exception", depth ? "issue-verify" : "verify", depth, error);
        }
        if (verification?.outcome === "blocked") {
          return await blockedHalt(depth ? "issue-verify" : "verify", depth, verification, "verify blocked");
        }
        if (verification?.outcome === "success") {
          const verifyNode = depth ? "issue-verify" : "verify";
          const next = await transition(verifyNode, "success", ["ship"], depth, verification);
          if (typeof next !== "string") return next;
          emit({type: "shipping", depth});
          const shipment = await adapter.ship({config, request, preflight, workspace, plan, verification, depth});
          if (shipment?.status !== "delivered") return shipment;
          const shipTarget = resolveTransition(config, "ship", "delivered");
          if (shipTarget !== "delivered") return await halt(`unsupported configured transition: ship.delivered -> ${shipTarget}`, "ship", depth, shipment);
          return shipment;
        }
        if (verification?.outcome !== "failure") {
          return await halt("verify returned invalid outcome", depth ? "issue-verify" : "verify", depth, verification);
        }
        const verifyNode = depth ? "issue-verify" : "verify";
        const next = await transition(verifyNode, "failure", ["issue-rca"], depth, verification);
        if (typeof next !== "string") return next;
        context = {history: [...context.history, verification]};
      }

      if (route === "issue" && depth >= config.runtime.max_issue_depth) {
        const target = resolveTransition(config, "issue-verify", "max-depth");
        return await halt(target === "halt" ? "max_issue_depth" : `unsupported configured transition: issue-verify.max-depth -> ${target}`, "issue-verify", depth, context);
      }
      route = "issue";
      depth += 1;
      emit({type: "issue-created", depth, context});
    }
  } finally {
    await adapter.cleanup({config, request, workspace});
  }
}
