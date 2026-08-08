import test from "node:test";
import assert from "node:assert/strict";
import {readyItems, resolveTransition, runBuild, runDag, validateConfig, validatePlan} from "../src/core.mjs";

const config = () => ({
  version: 1,
  runtime: {max_issue_depth: 3, node_retries: 1, command_timeout_seconds: 10},
  build: {max_concurrency: 2, max_items: 8},
  provisioning: {copy_env_files: true},
  models: {intent: "test/intent", spec_design: "test/spec", plan: "test/plan", rca: "test/rca", issue_plan: "test/issue", worker_high: "test/high", worker_mid: "test/mid", worker_low: "test/low"},
  nodes: {
    intent: {kind: "llm", outcomes: {sdlc: "spec-design", issue: "issue-rca", blocked: "halt"}},
    "spec-design": {kind: "llm", outcomes: {success: "plan", blocked: "halt"}},
    plan: {kind: "llm", outcomes: {success: "build", blocked: "halt"}},
    build: {kind: "parallel", model_by_complexity: {high: "worker_high", mid: "worker_mid", low: "worker_low"}, outcomes: {success: "verify", failure: "issue-rca", blocked: "halt"}},
    verify: {kind: "shell", outcomes: {success: "ship", failure: "issue-rca", blocked: "halt"}},
    "issue-rca": {kind: "llm", outcomes: {success: "issue-plan", blocked: "halt"}},
    "issue-plan": {kind: "llm", outcomes: {success: "issue-build", blocked: "halt"}},
    "issue-build": {kind: "parallel", model_by_complexity: {high: "worker_high", mid: "worker_mid", low: "worker_low"}, outcomes: {success: "issue-verify", failure: "issue-rca", blocked: "halt"}},
    "issue-verify": {kind: "shell", outcomes: {success: "ship", failure: "issue-rca", "max-depth": "halt", blocked: "halt"}},
    ship: {kind: "shell", outcomes: {delivered: "delivered", blocked: "halt"}},
  },
});

const item = (id, complexity = "low", depends_on = []) => ({
  id, title: id, objective: id, complexity, depends_on,
  acceptance_criteria: ["accepted"], affected_paths: [`src/${id}.mjs`], validation_commands: ["test -f package.json"],
});
const plan = (...items) => ({outcome: "success", items, final_validation_commands: ["test -f package.json"]});

test("validateConfig accepts valid config and rejects structural and numeric errors", () => {
  const valid = config();
  assert.equal(validateConfig(valid), valid);
  for (const [mutate, message] of [
    [(c) => c = null, "config must be an object"],
    [(c) => { c.version = 2; }, "config.version must be 1"],
    [(c) => { c.runtime = []; }, "config.runtime must be an object"],
    [(c) => { c.build = null; }, "config.build must be an object"],
    [(c) => { c.provisioning = null; }, "config.provisioning must be an object"],
    [(c) => { c.provisioning.extra = true; }, "must contain exactly copy_env_files"],
    [(c) => { c.provisioning.copy_env_files = "yes"; }, "copy_env_files must be a boolean"],
    [(c) => { c.models = "x"; }, "config.models must be an object"],
    [(c) => { c.nodes = []; }, "config.nodes must be an object"],
    [(c) => { c.runtime.max_issue_depth = 0; }, "runtime.max_issue_depth must be a positive integer"],
    [(c) => { c.runtime.command_timeout_seconds = 0; }, "runtime.command_timeout_seconds must be a positive integer"],
    [(c) => { c.runtime.node_retries = -1; }, "runtime.node_retries must be a non-negative integer"],
    [(c) => { c.build.max_concurrency = 0; }, "build.max_concurrency must be a positive integer"],
    [(c) => { c.build.max_items = 1.5; }, "build.max_items must be a positive integer"],
    [(c) => { c.nodes.build = null; }, "nodes.build must be an object"],
    [(c) => { c.models.intent = "unsafe model"; }, "safe provider/model"],
    [(c) => { c.models.intent = "test/model/extra"; }, "safe provider/model"],
    [(c) => { delete c.models.intent; }, "models.intent is required"],
    [(c) => { c.nodes.intent.kind = "shell"; }, "nodes.intent.kind must be llm"],
    [(c) => { c.nodes.intent.outcomes = null; }, "nodes.intent.outcomes must be an object"],
    [(c) => { c.nodes.intent.outcomes = {"": "halt"}; }, "invalid edge"],
    [(c) => { c.nodes.intent.outcomes.sdlc = "missing"; }, "invalid edge"],
    [(c) => { delete c.nodes.intent.outcomes.sdlc; }, "must declare exactly the supported outcomes"],
    [(c) => { c.nodes.intent.outcomes.extra = "halt"; }, "must declare exactly the supported outcomes"],
    [(c) => { c.nodes.custom = {kind: "llm", outcomes: {success: "missing"}}; }, "nodes.custom.outcomes has an invalid edge"],
    [(c) => { c.nodes.build.model_by_complexity = null; }, "nodes.build.model_by_complexity must be an object"],
    [(c) => { c.nodes.build.model_by_complexity.high = "missing"; }, "must reference a configured model"],
  ]) {
    let candidate = config();
    const replacement = mutate(candidate);
    if (replacement === null) candidate = replacement;
    assert.throws(() => validateConfig(candidate), new RegExp(message));
  }
});

test("validatePlan accepts a DAG and rejects every semantic class", () => {
  const valid = plan(item("a"), item("b", "mid", ["a"]));
  assert.equal(validatePlan(valid, config()), valid);
  const cases = [
    [{}, "plan.items must be a non-empty array"],
    [{items: [item("a")]}, "final_validation_commands must be a non-empty array"],
    [plan(item("a"), item("b")), "plan exceeds build.max_items", (c) => { c.build.max_items = 1; }],
    [plan(null), "plan item must be an object"],
    [plan(item("Bad")), "invalid id"],
    [plan(item("a"), item("a")), "duplicate item id"],
    [plan(item("a", "huge")), "unknown complexity tier"],
    [plan({...item("a"), depends_on: null}), "depends_on must be an array"],
    [plan({...item("a"), acceptance_criteria: []}), "requires acceptance_criteria"],
    [plan({...item("a"), affected_paths: []}), "requires acceptance_criteria"],
    [plan({...item("a"), validation_commands: []}), "requires acceptance_criteria"],
    [plan(item("a", "low", ["a"])), "cannot depend on itself"],
    [plan(item("a", "low", ["missing"])), "unknown dependency"],
    [plan(item("a"), item("b", "low", ["a", "a"])), "duplicate dependency"],
    [plan(item("a", "low", ["b"]), item("b", "low", ["a"])), "dependency cycle"],
    [plan({...item("a"), extra: true}), "unknown or missing fields"],
    [plan((() => { const value = item("a"); delete value.id; return value; })()), "item <unknown> has unknown or missing fields"],
    [plan({...item("a"), affected_paths: ["../escape"]}), "unsafe path"],
    [plan({...item("a"), affected_paths: ["/absolute"]}), "unsafe path"],
    [plan({...item("a"), affected_paths: [""]}), "unsafe path"],
    [plan({...item("a"), affected_paths: [1]}), "unsafe path"],
    [plan({...item("a"), validation_commands: ["Inspect the repository integration points"]}), "not prose"],
    [plan({...item("a"), validation_commands: ["Run the repository's test suite"]}), "not prose"],
    [plan({...item("a"), validation_commands: ["Manually verify the UI"]}), "not prose"],
    [plan({...item("a"), validation_commands: ["bun run dev"]}), "dev, watch, or server"],
    [plan({...item("a"), validation_commands: ["npm start | tee output.log"]}), "dev, watch, or server"],
    [plan({...item("a"), validation_commands: ["bun test --watch"]}), "dev, watch, or server"],
    [plan({...item("a"), validation_commands: ["test -f package.json\nrm file"]}), "single-line"],
    [plan({...item("a"), validation_commands: ["test\0x"]}), "single-line"],
    [plan({...item("a"), validation_commands: [""]}), "single-line"],
    [plan({...item("a"), validation_commands: [1]}), "single-line"],
    [{...plan(item("a")), final_validation_commands: ["Verify that tests pass"]}, "not prose"],
  ];
  for (const [candidate, message, mutate] of cases) {
    const cfg = config();
    mutate?.(cfg);
    assert.throws(() => validatePlan(candidate, cfg), new RegExp(message));
  }
  assert.equal(validatePlan({...plan(item("commands")), final_validation_commands: ["bun run check-types && npm test | tee test.log", "./scripts/check.sh", "check-types"]}, config()).outcome, "success");
});

test("configured transitions are resolved and unsupported ordering halts clearly", async () => {
  const cfg = config();
  assert.equal(resolveTransition(cfg, "intent", "sdlc"), "spec-design");
  assert.throws(() => resolveTransition(cfg, "intent", "missing"), /no transition/);
  cfg.nodes.intent.outcomes.sdlc = "halt";
  const halted = dagAdapter([{outcome: "sdlc"}]);
  assert.match((await runDag({config: cfg, request: "x", adapter: halted.adapter})).reason, /configured transition intent -> halt/);
  const unsupportedConfig = config();
  unsupportedConfig.nodes.intent.outcomes.sdlc = "issue-plan";
  const unsupported = dagAdapter([{outcome: "sdlc"}]);
  assert.match((await runDag({config: unsupportedConfig, request: "x", adapter: unsupported.adapter})).reason, /unsupported configured transition/);
});

test("configured nonstandard terminal and ordering edges are consumed", async () => {
  const blockedConfig = config();
  blockedConfig.nodes.intent.outcomes.blocked = "spec-design";
  const blocked = dagAdapter([{outcome: "blocked"}]);
  assert.match((await runDag({config: blockedConfig, request: "x", adapter: blocked.adapter})).reason, /unsupported configured transition/);

  const stageHaltConfig = config();
  stageHaltConfig.nodes["spec-design"].outcomes.success = "halt";
  const stageHalt = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}]);
  assert.match((await runDag({config: stageHaltConfig, request: "x", adapter: stageHalt.adapter})).reason, /configured transition spec-design -> halt/);

  const maxConfig = config();
  maxConfig.runtime.max_issue_depth = 1;
  maxConfig.nodes["issue-verify"].outcomes["max-depth"] = "ship";
  const max = dagAdapter([{outcome: "issue"}, {outcome: "success"}, plan(item("fix"))], {async verify() { return {outcome: "failure"}; }});
  assert.match((await runDag({config: maxConfig, request: "x", adapter: max.adapter})).reason, /unsupported configured transition: issue-verify.max-depth/);

  const shipConfig = config();
  shipConfig.nodes.ship.outcomes.delivered = "halt";
  const ship = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))]);
  assert.match((await runDag({config: shipConfig, request: "x", adapter: ship.adapter})).reason, /ship.delivered/);

  const blockedShip = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {async ship() { return {status: "halted", reason: "delivery blocked"}; }});
  assert.equal((await runDag({config: config(), request: "x", adapter: blockedShip.adapter})).reason, "delivery blocked");

  const cases = [
    ["plan", "success", [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {}],
    ["issue-rca", "success", [{outcome: "issue"}, {outcome: "success"}], {}],
    ["issue-plan", "success", [{outcome: "issue"}, {outcome: "success"}, plan(item("a"))], {}],
    ["build", "failure", [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {async runWorker() { return {outcome: "failure"}; }}],
    ["build", "success", [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {}],
    ["verify", "success", [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {}],
    ["verify", "failure", [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {async verify() { return {outcome: "failure"}; }}],
  ];
  for (const [node, outcome, nodes, overrides] of cases) {
    const cfg = config();
    cfg.nodes[node].outcomes[outcome] = "halt";
    const fixture = dagAdapter(nodes, overrides);
    assert.match((await runDag({config: cfg, request: "x", adapter: fixture.adapter})).reason, new RegExp(`configured transition ${node} -> halt`));
  }

  const unsupportedStageConfig = config();
  unsupportedStageConfig.nodes["spec-design"].outcomes.success = "issue-plan";
  const unsupportedStage = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}]);
  assert.match((await runDag({config: unsupportedStageConfig, request: "x", adapter: unsupportedStage.adapter})).reason, /unsupported configured transition/);
});

test("readyItems requires pending ownership and integrated joins, then sorts", () => {
  const items = [item("z"), item("b", "low", ["a"]), item("a")];
  assert.deepEqual(readyItems(items, {z: "pending", b: "pending", a: "integrated"}).map((x) => x.id), ["b", "z"]);
  assert.deepEqual(readyItems(items, {z: "running", b: "pending", a: "pending"}).map((x) => x.id), ["a"]);
});

test("runBuild selects route tiers, caps concurrency, serializes integration, and joins dependencies", async () => {
  const cfg = config();
  const starts = [];
  const models = [];
  let active = 0;
  let peak = 0;
  let integrating = 0;
  let releaseA;
  const gateA = new Promise((resolve) => { releaseA = resolve; });
  const adapter = {
    async runWorker({item: work, model, depth, attempt}) {
      starts.push(work.id); models.push([work.id, model, depth, attempt]);
      active += 1; peak = Math.max(peak, active);
      if (work.id === "a") await gateA;
      active -= 1;
      return {outcome: "success"};
    },
    async integrate({item: work}) {
      assert.equal(integrating, 0);
      integrating += 1;
      await Promise.resolve();
      integrating -= 1;
      return {outcome: "success", id: work.id};
    },
  };
  const execution = runBuild({
    plan: plan(item("a", "high"), item("b", "mid"), item("c", "low", ["a", "b"]), item("d")),
    config: cfg, depth: 1, adapter, record() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, ["a", "b", "d"]);
  assert.equal(peak, 2);
  assert.equal(starts.includes("c"), false);
  releaseA();
  const result = await execution;
  assert.equal(result.outcome, "success");
  assert.deepEqual(result.statuses, {a: "integrated", b: "integrated", c: "integrated", d: "integrated"});
  assert.deepEqual(models, [["a", "test/high", 1, 1], ["b", "test/mid", 1, 1], ["d", "test/low", 1, 1], ["c", "test/low", 1, 1]]);
});

test("runBuild retries infrastructure errors then succeeds", async () => {
  const attempts = [];
  const events = [];
  const result = await runBuild({plan: plan(item("a")), config: config(), depth: 0, record: (event) => events.push(event), adapter: {
    async runWorker({attempt}) { attempts.push(attempt); if (attempt === 1) throw new Error("temporary"); return {outcome: "success"}; },
    async integrate() { return {outcome: "success"}; },
  }});
  assert.equal(result.outcome, "success");
  assert.deepEqual(attempts, [1, 2]);
  assert.equal(events.some((event) => event.type === "worker-exception"), true);
});

test("runBuild returns blocked after retries and drains already running work", async () => {
  let drained = false;
  const result = await runBuild({plan: plan(item("a"), item("b")), config: config(), depth: 0, adapter: {
    async runWorker({item: work}) {
      if (work.id === "a") throw new Error("down");
      await new Promise((resolve) => setImmediate(resolve));
      drained = true;
      return {outcome: "success"};
    },
    async integrate() { return {outcome: "success"}; },
  }});
  assert.equal(result.outcome, "blocked");
  assert.match(result.reason, /retries exhausted/);
  assert.equal(drained, true);
});

test("runBuild classifies worker and integration outcomes", async () => {
  for (const [worker, integrate, outcome, reason] of [
    [{outcome: "failure"}, {outcome: "success"}, "failure", /worker a failure/],
    [{outcome: "blocked"}, {outcome: "success"}, "blocked", /worker a blocked/],
    [undefined, {outcome: "success"}, "failure", /worker a failed/],
    [{outcome: "success"}, {outcome: "failure"}, "failure", /integration a failure/],
    [{outcome: "success"}, {outcome: "blocked"}, "blocked", /integration a blocked/],
    [{outcome: "success"}, undefined, "failure", /integration a failed/],
  ]) {
    const result = await runBuild({plan: plan(item("a")), config: config(), depth: 0, adapter: {
      async runWorker() { return worker; }, async integrate() { return integrate; },
    }});
    assert.equal(result.outcome, outcome);
    assert.match(result.reason, reason);
  }
  const exception = await runBuild({plan: plan(item("a")), config: config(), depth: 0, adapter: {
    async runWorker() { return {outcome: "success"}; }, async integrate() { throw new Error("git unavailable"); },
  }});
  assert.equal(exception.outcome, "blocked");
  assert.match(exception.reason, /infrastructure exception/);
});

const dagAdapter = (nodeResults, overrides = {}) => {
  const calls = [];
  let cleanup = 0;
  const adapter = {
    async preflight(args) { calls.push(["preflight", args]); return {status: "ready"}; },
    async createWorkspace(args) { calls.push(["workspace", args]); return {id: "ws"}; },
    async runNode(args) { calls.push([args.node, args.depth]); const value = nodeResults.shift(); return typeof value === "function" ? value(args) : value; },
    async runWorker(args) { calls.push(["worker", args.depth]); return {outcome: "success"}; },
    async integrate(args) { calls.push(["integrate", args.depth]); return {outcome: "success"}; },
    async verify(args) { calls.push(["verify", args.depth]); return {outcome: "success"}; },
    async ship(args) { calls.push(["ship", args.depth]); return {status: "delivered"}; },
    async halt(args) { calls.push(["halt", args.reason, args.depth]); return {status: "halted", reason: args.reason}; },
    async cleanup(args) { cleanup += 1; calls.push(["cleanup", args.workspace]); },
    ...overrides,
  };
  return {adapter, calls, get cleanup() { return cleanup; }};
};

test("runDag executes SDLC and issue intent routes through ship", async () => {
  const sdlc = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))]);
  assert.deepEqual(await runDag({config: config(), request: "feature", adapter: sdlc.adapter}), {status: "delivered"});
  assert.deepEqual(sdlc.calls.map((call) => call[0]), ["preflight", "workspace", "intent", "spec-design", "plan", "worker", "integrate", "verify", "ship", "cleanup"]);
  assert.equal(sdlc.cleanup, 1);

  const issue = dagAdapter([{outcome: "issue"}, {outcome: "success"}, plan(item("fix"))]);
  await runDag({config: config(), request: "bug", adapter: issue.adapter});
  assert.deepEqual(issue.calls.filter((call) => ["issue-rca", "issue-plan", "verify", "ship"].includes(call[0])), [["issue-rca", 1], ["issue-plan", 1], ["verify", 1], ["ship", 1]]);
});

test("runDag routes SDLC build and verify failures into issue depth one", async () => {
  for (const buildFails of [true, false]) {
    const nodes = [{outcome: "sdlc"}, {outcome: "success"}, plan(item("initial")), {outcome: "success"}, plan(item("repair"))];
    let workers = 0;
    let verifies = 0;
    const fixture = dagAdapter(nodes, {
      async runWorker() { workers += 1; return buildFails && workers === 1 ? {outcome: "failure"} : {outcome: "success"}; },
      async integrate() { return {outcome: "success"}; },
      async verify() { verifies += 1; return !buildFails && verifies === 1 ? {outcome: "failure"} : {outcome: "success"}; },
    });
    const result = await runDag({config: config(), request: "work", adapter: fixture.adapter});
    assert.equal(result.status, "delivered");
    assert.deepEqual(fixture.calls.filter((call) => call[0] === "issue-rca"), [["issue-rca", 1]]);
  }
});

test("runDag preserves original request, cumulative context, and baseline validation across repair", async () => {
  const cfg = config();
  cfg.runtime.max_issue_depth = 1;
  const initial = plan(item("same"));
  initial.final_validation_commands = ["original-fails", "shared"];
  const repair = plan(item("same"));
  repair.final_validation_commands = ["shared", "weak-only"];
  const seenInputs = [];
  const validations = [];
  const fixture = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, initial, {outcome: "success"}, repair], {
    async runNode(args) {
      seenInputs.push(args.input);
      const value = [{outcome: "sdlc"}, {outcome: "success"}, initial, {outcome: "success"}, repair][seenInputs.length - 1];
      return value;
    },
    async runWorker(args) {
      assert.equal(args.request, "immutable request");
      assert.ok(args.context.history.length >= 3);
      return {outcome: "success"};
    },
    async verify(args) { validations.push(args.validationCommands); return {outcome: "failure"}; },
  });
  const result = await runDag({config: cfg, request: "immutable request", adapter: fixture.adapter});
  assert.equal(result.reason, "max_issue_depth");
  assert.equal(seenInputs.every((input) => input.request === "immutable request"), true);
  assert.deepEqual(validations, [["original-fails", "shared"], ["original-fails", "shared", "weak-only"]]);
});

test("runDag increments issue failures and halts at max depth", async () => {
  const nodes = [{outcome: "issue"}];
  for (let depth = 1; depth <= 3; depth += 1) nodes.push({outcome: "success"}, plan(item(`fix-${depth}`)));
  const fixture = dagAdapter(nodes, {async verify() { return {outcome: "failure"}; }});
  const result = await runDag({config: config(), request: "bug", adapter: fixture.adapter});
  assert.deepEqual(result, {status: "halted", reason: "max_issue_depth"});
  assert.deepEqual(fixture.calls.filter((call) => call[0] === "issue-rca").map((call) => call[1]), [1, 2, 3]);
});

test("runDag halts all blocked and invalid controller paths", async () => {
  const scenarios = [
    {nodes: [], overrides: {async preflight() { return {status: "blocked"}; }}, reason: "preflight blocked"},
    {nodes: [], overrides: {async createWorkspace() { return {status: "blocked", reason: "install failed", provisioning: {exitCode: 1}}; }}, reason: "integration provisioning infrastructure blocked: install failed"},
    {nodes: [{outcome: "blocked"}], reason: "intent blocked"},
    {nodes: [{outcome: "mystery"}], reason: "intent returned invalid outcome"},
    {nodes: [{outcome: "sdlc"}, {outcome: "blocked"}], reason: "spec-design blocked"},
    {nodes: [{outcome: "sdlc"}, {outcome: "success"}, {outcome: "blocked"}], reason: "plan blocked"},
    {nodes: [{outcome: "issue"}, {outcome: "blocked"}], reason: "issue-rca blocked"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, {outcome: "blocked"}], reason: "issue-plan blocked"},
    {nodes: [{outcome: "sdlc"}, {outcome: "success"}, {outcome: "success", items: []}], reason: "invalid sdlc plan"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, {outcome: "success", items: []}], reason: "invalid issue plan"},
    {nodes: [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], overrides: {async runWorker() { return {outcome: "blocked"}; }}, reason: "worker a blocked"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, plan(item("a"))], overrides: {async runWorker() { return {outcome: "blocked"}; }}, reason: "worker a blocked"},
    {nodes: [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], overrides: {async verify() { return {outcome: "blocked"}; }}, reason: "verify blocked"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, plan(item("a"))], overrides: {async verify() { throw new Error("issue shell"); }}, reason: "verify infrastructure exception"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, plan(item("a"))], overrides: {async verify() { return {outcome: "blocked"}; }}, reason: "verify blocked"},
    {nodes: [{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], overrides: {async verify() { return {outcome: "other"}; }}, reason: "verify returned invalid outcome"},
    {nodes: [{outcome: "issue"}, {outcome: "success"}, plan(item("a"))], overrides: {async verify() { return {outcome: "other"}; }}, reason: "verify returned invalid outcome"},
  ];
  for (const scenario of scenarios) {
    const fixture = dagAdapter([...scenario.nodes], scenario.overrides);
    const result = await runDag({config: config(), request: "x", adapter: fixture.adapter});
    assert.equal(result.status, "halted");
    assert.match(result.reason, new RegExp(scenario.reason));
    assert.equal(fixture.cleanup, 1);
  }
});

test("runDag converts node and verify exceptions to halts", async () => {
  const node = dagAdapter([{outcome: "sdlc"}, () => { throw new Error("harness"); }]);
  assert.match((await runDag({config: config(), request: "x", adapter: node.adapter})).reason, /spec-design infrastructure exception/);
  const verify = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {async verify() { throw new Error("shell"); }});
  assert.equal((await runDag({config: config(), request: "x", adapter: verify.adapter})).reason, "verify infrastructure exception");
});

test("runDag cleanup runs exactly once when setup or shipping throws", async () => {
  for (const overrides of [
    {async createWorkspace() { throw new Error("workspace"); }},
    {async ship() { throw new Error("delivery"); }},
  ]) {
    let cleanups = 0;
    const fixture = dagAdapter([{outcome: "sdlc"}, {outcome: "success"}, plan(item("a"))], {
      ...overrides,
      async cleanup() { cleanups += 1; },
    });
    await assert.rejects(runDag({config: config(), request: "x", adapter: fixture.adapter}));
    assert.equal(cleanups, 1);
  }
});
