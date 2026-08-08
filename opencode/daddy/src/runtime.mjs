import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {promises as nodeFs} from "node:fs";
import {homedir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import YAML from "yaml";
import {runDag, validateConfig, validatePlan} from "./core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = path.resolve(here, "../daddy-config.yaml");
const PROMPT_ROOT = path.resolve(here, "../prompts");

const expandHome = (value) => value === "~" ? homedir() : value?.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
const safePart = (value, name) => {
  const part = String(value);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(part)) throw new Error(`${name} is not a safe identifier`);
  return part;
};
const asResult = (result) => ({stdout: result.stdout ?? "", stderr: result.stderr ?? "", exitCode: result.exitCode ?? result.exit_code ?? 0});
const PROVISIONING = {
  bun: {strategy: "bun", program: "bun", args: ["install", "--frozen-lockfile"]},
  pnpm: {strategy: "pnpm", program: "pnpm", args: ["install", "--frozen-lockfile"]},
  yarn: {strategy: "yarn", program: "yarn", args: ["install", "--immutable"]},
  npm: {strategy: "npm", program: "npm", args: ["ci"]},
};
const INFRASTRUCTURE_EXIT_CODES = new Set([126, 127]);

const safeRelativePath = (value) => typeof value === "string"
  && value.length > 0
  && !value.includes("\0")
  && !path.isAbsolute(value)
  && !path.win32.isAbsolute(value)
  && !value.split(/[\\/]/).includes("..");
const contained = (root, target) => {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};
const environmentFile = (relative) => {
  const basename = path.posix.basename(relative);
  if (basename !== ".env" && !basename.startsWith(".env.")) return false;
  return !basename.slice(5).split(".").some((part) => ["example", "sample", "template"].includes(part));
};

const discoverEnvironmentFiles = async (repositoryRoot, command) => {
  const result = await command("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"], {cwd: repositoryRoot});
  if (result.exitCode !== 0) throw new Error("ignored environment file discovery failed");
  const selected = [];
  for (const relative of result.stdout.split("\0")) {
    if (!relative) continue;
    if (!safeRelativePath(relative)) throw new Error("ignored environment file discovery returned an unsafe path");
    if (environmentFile(relative)) selected.push(relative);
  }
  return [...new Set(selected)].sort();
};

const ensureSafeParent = async (fs, root, relative) => {
  let current = root;
  for (const part of path.dirname(relative).split(path.sep).filter((entry) => entry && entry !== ".")) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await fs.mkdir(current);
      stat = await fs.lstat(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("unsafe destination parent");
    if (!contained(root, await fs.realpath(current))) throw new Error("destination parent escapes worktree");
  }
};

export const copyEnvironmentFile = async (fs, sourceRoot, destinationRoot, relative) => {
  if (!safeRelativePath(relative)) throw new Error("unsafe environment file path");
  const source = path.resolve(sourceRoot, relative);
  const destination = path.resolve(destinationRoot, relative);
  const sourceStat = await fs.lstat(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) throw new Error("environment file source is not a regular file");
  const sourceReal = await fs.realpath(source);
  if (!contained(sourceRoot, sourceReal)) throw new Error("environment file source escapes repository");
  await ensureSafeParent(fs, destinationRoot, relative);
  try {
    const destinationStat = await fs.lstat(destination);
    if (destinationStat.isSymbolicLink() || !destinationStat.isFile()) throw new Error("environment file destination is not a regular file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.copyFile(sourceReal, destination);
  await fs.chmod(destination, sourceStat.mode & 0o777);
  const destinationStat = await fs.lstat(destination);
  if (destinationStat.isSymbolicLink() || !contained(destinationRoot, await fs.realpath(destination))) throw new Error("environment file destination escapes worktree");
};

export async function detectProvisioning(repositoryRoot, fs = nodeFs) {
  let declared;
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"));
    const match = typeof manifest.packageManager === "string" ? /^(bun|pnpm|yarn|npm)@\S+$/.exec(manifest.packageManager) : null;
    declared = match?.[1];
  } catch {}
  if (declared) return {...PROVISIONING[declared], args: [...PROVISIONING[declared].args]};
  for (const [lockfile, manager] of [["bun.lock", "bun"], ["bun.lockb", "bun"], ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"]]) {
    try {
      await fs.access(path.join(repositoryRoot, lockfile));
      return {...PROVISIONING[manager], args: [...PROVISIONING[manager].args]};
    } catch {}
  }
  return {strategy: "none", program: null, args: []};
}

export async function execute(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: options.cwd, env: options.env ?? process.env, shell: false});
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    const timer = options.timeout ? setTimeout(() => child.kill("SIGKILL"), options.timeout) : null;
    child.on("close", (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      resolve({stdout, stderr, exitCode: exitCode ?? 1});
    });
  });
}

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH, adapters = {}) {
  const fs = adapters.fs ?? nodeFs;
  const absolutePath = path.resolve(expandHome(configPath));
  const config = YAML.parse(await fs.readFile(absolutePath, "utf8"));
  validateConfig(config);
  if (config.paths) {
    config.paths.run_root = path.resolve(expandHome(config.paths.run_root));
    config.paths.worktree_root = path.resolve(expandHome(config.paths.worktree_root));
  }
  return config;
}

const atomicWrite = async (fs, target, value) => {
  const temporary = `${target}.tmp`;
  const body = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(temporary, body, "utf8");
  await fs.rename(temporary, target);
};

export async function prepareRun({repo, config, fs: suppliedFs, clock, id} = {}) {
  const fs = suppliedFs ?? nodeFs;
  const cfg = validateConfig(config ?? await loadConfig(DEFAULT_CONFIG_PATH, {fs}));
  const repositoryRoot = await fs.realpath(path.resolve(expandHome(repo ?? process.cwd())));
  const now = clock?.now?.() ?? new Date();
  const invocationDirectory = path.resolve(process.cwd());
  const generated = id?.() ?? `${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID()}`;
  const runId = safePart(generated, "run ID");
  const runRoot = path.resolve(expandHome(cfg.paths?.run_root ?? "~/.local/state/opencode/daddy/runs"));
  const runDir = path.join(runRoot, runId);
  const requestPath = path.join(runDir, "request", "request.txt");
  const metadataPath = path.join(runDir, "metadata.json");
  const configPath = path.join(runDir, "config.json");
  const statePath = path.join(runDir, "state", "run.json");
  const eventsPath = path.join(runDir, "events", "events.jsonl");
  await fs.mkdir(runRoot, {recursive: true});
  await fs.mkdir(runDir);
  for (const directory of [path.dirname(requestPath), path.dirname(statePath), path.dirname(eventsPath), path.join(runDir, "nodes"), path.join(runDir, "preflight"), path.join(runDir, "delivery"), path.join(runDir, "halted")]) {
    await fs.mkdir(directory, {recursive: true});
  }
  const createdAt = now.toISOString();
  const metadata = {schema_version: 1, run_id: runId, repository_root: repositoryRoot, invocation_directory: invocationDirectory, run_dir: runDir, request_path: requestPath, config_path: configPath, created_at: createdAt};
  const state = {schema_version: 1, run_id: runId, sequence: 0, status: "created", current_nodes: [], issue_depth: 0, repository_root: repositoryRoot, integration_branch: null, updated_at: createdAt};
  await atomicWrite(fs, metadataPath, metadata);
  await atomicWrite(fs, configPath, cfg);
  await atomicWrite(fs, statePath, state);
  await atomicWrite(fs, eventsPath, "");
  await atomicWrite(fs, requestPath, "");
  return {runId, runDir, requestPath, metadataPath, configPath, statePath, eventsPath, repositoryRoot, invocationDirectory};
}

const requiredCommon = (value, context, nodeId) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("node output must be an object");
  if (value.schema_version !== 1 || value.run_id !== context.runId || value.node_id !== nodeId) throw new Error("node output identity mismatch");
  if (!["success", "blocked"].includes(value.status) || typeof value.summary !== "string") throw new Error("node output common contract is invalid");
  stringArray(value.artifacts, "artifacts");
  if ((value.status === "blocked") !== (value.outcome === "blocked")) throw new Error("node output status and outcome disagree");
};

const stringArray = (value, name, nonEmpty = false) => {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0) || value.some((entry) => typeof entry !== "string" || !entry) || new Set(value).size !== value.length) throw new Error(`${name} must be a unique string array`);
};

const exactKeys = (value, keys, name) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${name} output has unknown or missing fields`);
};

const validateNodeOutput = (value, context, node, nodeId, item) => {
  requiredCommon(value, context, nodeId);
  if (node === "intent") {
    exactKeys(value, ["schema_version", "run_id", "node_id", "status", "outcome", "summary", "artifacts", "evidence"], "intent");
    stringArray(value.evidence, "intent evidence", true);
    if (!["sdlc", "issue", "blocked"].includes(value.outcome)) throw new Error("intent output is invalid");
  } else if (node === "spec-design") {
    exactKeys(value, ["schema_version", "run_id", "node_id", "status", "outcome", "summary", "artifacts", "acceptance_criteria", "constraints"], "spec");
    stringArray(value.acceptance_criteria, "spec acceptance criteria", true);
    stringArray(value.constraints, "spec constraints");
    if (!["success", "blocked"].includes(value.outcome)) throw new Error("spec output is invalid");
  } else if (node === "plan" || node === "issue-plan") {
    exactKeys(value, ["schema_version", "run_id", "node_id", "status", "outcome", "summary", "artifacts", "items", "final_validation_commands"], "plan");
    if (!["success", "blocked"].includes(value.outcome)) throw new Error("plan output is invalid");
    if (value.outcome === "success") {
      validatePlan(value, context.config);
      stringArray(value.final_validation_commands, "final validation commands", true);
      for (const planItem of value.items) {
        if (typeof planItem.title !== "string" || !planItem.title || typeof planItem.objective !== "string" || !planItem.objective) throw new Error("plan item title and objective are required");
        for (const key of ["depends_on", "acceptance_criteria", "affected_paths", "validation_commands"]) stringArray(planItem[key], `plan item ${planItem.id}.${key}`, ["acceptance_criteria", "validation_commands"].includes(key));
      }
    }
  } else if (node === "issue-rca") {
    exactKeys(value, ["schema_version", "run_id", "node_id", "status", "outcome", "summary", "artifacts", "root_cause", "evidence", "reproduction"], "RCA");
    stringArray(value.evidence, "RCA evidence", true);
    stringArray(value.reproduction, "RCA reproduction", true);
    if (!["success", "blocked"].includes(value.outcome) || typeof value.root_cause !== "string" || !value.root_cause) throw new Error("RCA output is invalid");
  } else {
    exactKeys(value, ["schema_version", "run_id", "node_id", "status", "outcome", "summary", "artifacts", "item_id", "changed_paths"], "worker");
    stringArray(value.changed_paths, "worker changed paths");
    if (!["success", "blocked"].includes(value.outcome) || value.item_id !== item.id) throw new Error("worker output is invalid");
    if (value.outcome === "success" && value.changed_paths.length === 0) throw new Error("successful worker output requires changed paths");
    for (const changed of value.changed_paths) if (path.isAbsolute(changed) || changed.split(/[\\/]/).includes("..")) throw new Error("worker changed path escapes worktree");
  }
  return value;
};

export function createRuntimeAdapter(context, dependencies = {}) {
  const fs = dependencies.fs ?? nodeFs;
  const run = dependencies.execute ?? execute;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = dependencies.now ?? (() => new Date());
  const promptRoot = dependencies.promptRoot ?? PROMPT_ROOT;
  const ctx = {...context};
  ctx.runId = ctx.runId ?? ctx.metadata?.run_id;
  ctx.runDir = path.resolve(ctx.runDir ?? ctx.metadata?.run_dir);
  ctx.repositoryRoot = path.resolve(ctx.repositoryRoot ?? ctx.metadata?.repository_root);
  ctx.config = validateConfig(ctx.config);
  const worktrees = new Set();
  const workers = new Map();
  let preflightResult;
  let workspaceResult;
  let sequence = 0;
  let events = "";
  let pendingWrites = Promise.resolve();
  let writeError;

  const commandTimeout = ctx.config.runtime.command_timeout_seconds * 1000;
  const command = async (program, args, options = {}) => asResult(await run(program, args, {timeout: commandTimeout, ...options}));
  const git = (args, cwd = ctx.repositoryRoot) => command("git", args, {cwd});
  const enqueue = (operation) => {
    const current = pendingWrites.then(operation);
    pendingWrites = current.catch((error) => { writeError ??= error; });
    return current;
  };
  const state = (status, extra = {}, detail = extra) => enqueue(async () => {
    sequence += 1;
    const value = {schema_version: 1, run_id: ctx.runId, sequence, status, current_nodes: extra.current_nodes ?? [], issue_depth: extra.issue_depth ?? 0, repository_root: ctx.repositoryRoot, integration_branch: workspaceResult?.branch ?? null, updated_at: now().toISOString()};
    await atomicWrite(fs, path.join(ctx.runDir, "state", "run.json"), value);
    events += `${JSON.stringify({sequence, state_status: status, at: value.updated_at, ...detail})}\n`;
    await atomicWrite(fs, path.join(ctx.runDir, "events", "events.jsonl"), events);
  });
  const flushRecords = async () => {
    await pendingWrites;
    if (writeError) throw writeError;
  };
  const removeWorktree = async (entry, removeBranch = false) => {
    if (!entry || !worktrees.has(entry.path)) return true;
    const removed = await git(["worktree", "remove", "--force", entry.path]);
    if (removed.exitCode !== 0) return false;
    worktrees.delete(entry.path);
    if (removeBranch && (await git(["branch", "-D", entry.branch])).exitCode !== 0) return false;
    return true;
  };
  const cleanupAll = async () => {
    let success = true;
    for (const worker of workers.values()) success = await removeWorktree(worker, false) && success;
    success = await removeWorktree(workspaceResult, false) && success;
    return success;
  };
  const porcelainPaths = (output) => {
    const records = output.split("\0");
    const changed = [];
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!record) continue;
      const status = record.slice(0, 2);
      changed.push(record.slice(3));
      if (/[RC]/.test(status)) index += 1;
    }
    return changed.sort();
  };
  const provision = async (entry, artifactPath, attempt) => {
    if (entry.provisioned) return {status: "success", skipped: true};
    await fs.mkdir(path.dirname(artifactPath), {recursive: true});
    const strategy = preflightResult.provisioning;
    const environmentFiles = [];
    try {
      const sourceRoot = await fs.realpath(ctx.repositoryRoot);
      const destinationRoot = await fs.realpath(entry.path);
      for (const relative of preflightResult.environment_files) {
        try {
          await copyEnvironmentFile(fs, sourceRoot, destinationRoot, relative);
          environmentFiles.push({path: relative, status: "copied"});
        } catch {
          environmentFiles.push({path: relative, status: "blocked"});
          const blocked = {schema_version: 1, run_id: ctx.runId, attempt, strategy: strategy.strategy, program: strategy.program, args: strategy.args, cwd: entry.path, stdout: "", stderr: "", exitCode: null, environment_files: environmentFiles, status: "blocked", reason: "environment file copy failed"};
          await atomicWrite(fs, artifactPath, blocked);
          return blocked;
        }
      }
    } catch {
      const blocked = {schema_version: 1, run_id: ctx.runId, attempt, strategy: strategy.strategy, program: strategy.program, args: strategy.args, cwd: entry.path, stdout: "", stderr: "", exitCode: null, environment_files: environmentFiles, status: "blocked", reason: "environment file copy safety check failed"};
      await atomicWrite(fs, artifactPath, blocked);
      return blocked;
    }
    const result = strategy.program
      ? await command(strategy.program, strategy.args, {cwd: entry.path})
      : {stdout: "", stderr: "", exitCode: 0};
    const evidence = {schema_version: 1, run_id: ctx.runId, attempt, strategy: strategy.strategy, program: strategy.program, args: strategy.args, cwd: entry.path, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, environment_files: environmentFiles};
    if (result.exitCode !== 0) {
      const blocked = {...evidence, status: "blocked", reason: "dependency provisioning command failed"};
      await atomicWrite(fs, artifactPath, blocked);
      return blocked;
    }
    const tracked = await git(["status", "--porcelain", "--untracked-files=no"], entry.path);
    if (tracked.exitCode !== 0 || tracked.stdout) {
      const blocked = {...evidence, status: "blocked", reason: tracked.exitCode !== 0 ? "dependency provisioning Git status failed" : "dependency provisioning modified tracked files", tracked_status: tracked};
      await atomicWrite(fs, artifactPath, blocked);
      return blocked;
    }
    entry.provisioned = true;
    const success = {...evidence, status: "success", tracked_status: tracked};
    await atomicWrite(fs, artifactPath, success);
    return success;
  };
  const provisioningReason = (evidence) => `${evidence.reason}: program=${JSON.stringify(evidence.program)} args=${JSON.stringify(evidence.args)} exitCode=${evidence.exitCode} stdout=${JSON.stringify(evidence.stdout)} stderr=${JSON.stringify(evidence.stderr)} environmentFiles=${JSON.stringify(evidence.environment_files)}${evidence.tracked_status ? ` trackedStatus=${JSON.stringify(evidence.tracked_status)}` : ""}`;
  const checkpoint = async (entry, message) => {
    const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], entry.path);
    if (status.exitCode !== 0) return null;
    if (status.stdout) {
      const added = await git(["add", "--all"], entry.path);
      const committed = added.exitCode === 0 ? await git(["commit", "-m", message], entry.path) : added;
      if (committed.exitCode !== 0) return null;
    }
    const head = await git(["rev-parse", "HEAD"], entry.path);
    return head.exitCode === 0 && head.stdout.trim() ? {branch: entry.branch, commit: head.stdout.trim(), node_id: entry.nodeId ?? null} : null;
  };
  const nodeIdentity = (node, depth, item) => {
    const route = depth ? `issue.${depth}` : "sdlc";
    if (item) return `${route}.build.${item.id}`;
    return ({intent: "intent", "spec-design": "sdlc.spec-design", plan: "sdlc.plan", "issue-rca": `${route}.rca`, "issue-plan": `${route}.plan`})[node];
  };
  const modelFor = (node) => ctx.config.models[({intent: "intent", "spec-design": "spec_design", plan: "plan", "issue-rca": "rca", "issue-plan": "issue_plan"})[node]];

  const harness = async ({node, nodeId, model, cwd, input, item, attempt = 1}) => {
    const attemptDir = path.join(ctx.runDir, "nodes", nodeId, String(attempt));
    await fs.mkdir(attemptDir, {recursive: true});
    const inputPath = path.join(attemptDir, "input.json");
    const outputPath = path.join(attemptDir, "output.json");
    const completePath = path.join(attemptDir, "complete");
    await atomicWrite(fs, inputPath, {schema_version: 1, run_id: ctx.runId, node_id: nodeId, input});
    const template = await fs.readFile(path.join(promptRoot, `${node}.md`), "utf8");
    const prompt = template.replaceAll("{{INPUT_PATH}}", inputPath).replaceAll("{{OUTPUT_PATH}}", outputPath).replaceAll("{{COMPLETE_PATH}}", completePath).replaceAll("{{RUN_ID}}", ctx.runId).replaceAll("{{NODE_ID}}", nodeId);
    let pane;
    try {
      const created = await command("herdr", ["workspace", "create", "--cwd", cwd, "--label", `daddy-${safePart(nodeId.replaceAll(".", "-"), "node ID")}`, "--no-focus"]);
      if (created.exitCode !== 0) throw new Error(`Herdr workspace create failed: ${created.stderr}`);
      try { pane = JSON.parse(created.stdout).result.root_pane.pane_id; } catch { throw new Error("Herdr returned malformed workspace JSON"); }
      if (!pane) throw new Error("Herdr did not return a pane ID");
      const send = async (text) => {
        const result = await command("herdr", ["pane", "send-text", pane, text]);
        if (result.exitCode !== 0) throw new Error(`Herdr send-text failed: ${result.stderr}`);
        const enter = await command("herdr", ["pane", "send-keys", pane, "Enter"]);
        if (enter.exitCode !== 0) throw new Error(`Herdr send-keys failed: ${enter.stderr}`);
      };
      await send(`opencode --auto --model ${model}`);
      const ready = await command("herdr", ["wait", "output", pane, "--match", "Ask anything", "--source", "visible", "--lines", "40", "--timeout", String(ctx.config.runtime.startup_timeout_seconds * 1000)]);
      if (ready.exitCode !== 0) throw new Error("OpenCode startup timed out");
      await send(prompt);
      const polls = Math.max(1, Math.ceil(ctx.config.runtime.node_timeout_seconds / ctx.config.runtime.poll_interval_seconds));
      let output;
      for (let poll = 0; poll < polls; poll += 1) {
        try {
          await fs.access(completePath);
        } catch (error) {
          if (poll === polls - 1) throw new Error(`node output timeout or malformed contract: ${error.message}`);
          await sleep(ctx.config.runtime.poll_interval_seconds * 1000);
          continue;
        }
        try {
          output = validateNodeOutput(JSON.parse(await fs.readFile(outputPath, "utf8")), ctx, node, nodeId, item);
        } catch (error) {
          throw new Error(`node published malformed contract: ${error.message}`);
        }
        break;
      }
      if (ctx.config.runtime.require_idle_status) {
        const idle = await command("herdr", ["wait", "agent-status", pane, "--status", "idle", "--timeout", String(ctx.config.runtime.node_timeout_seconds * 1000)]);
        if (idle.exitCode !== 0) throw new Error("OpenCode idle wait timed out");
      }
      return {...output, outputPath, worktree: cwd};
    } finally {
      if (pane) await command("herdr", ["pane", "close", pane]);
    }
  };

  const adapter = {
    async preflight() {
      await state("preflight");
      const root = await git(["rev-parse", "--show-toplevel"]);
      const sha = await git(["rev-parse", "HEAD"]);
      const branch = await git(["branch", "--show-current"]);
      const dirty = await git(["status", "--porcelain"]);
      if ([root, sha, branch, dirty].some((result) => result.exitCode !== 0) || !branch.stdout.trim()) return {status: "blocked", reason: "not a usable Git repository"};
      if (path.resolve(root.stdout.trim()) !== ctx.repositoryRoot) return {status: "blocked", reason: "repository root mismatch"};
      if (dirty.stdout.trim()) return {status: "blocked", reason: "Git worktree is not clean"};
      const remoteName = ctx.config.git?.remote ?? "origin";
      const remoteProbe = await git(["remote", "get-url", remoteName]);
      const hasRemote = remoteProbe.exitCode === 0;
      const configuredBase = ctx.config.git?.base_branch;
      let baseBranch = configuredBase && configuredBase !== "auto" ? configuredBase : null;
      if (!baseBranch && hasRemote) {
        const remoteHead = await git(["symbolic-ref", "--short", `refs/remotes/${remoteName}/HEAD`]);
        if (remoteHead.exitCode === 0) baseBranch = remoteHead.stdout.trim().replace(`${remoteName}/`, "");
      }
      baseBranch ||= branch.stdout.trim();
      const localBase = await git(["rev-parse", "--verify", baseBranch]);
      const remoteBase = hasRemote && localBase.exitCode !== 0 ? await git(["rev-parse", "--verify", `${remoteName}/${baseBranch}`]) : localBase;
      if (localBase.exitCode !== 0 && remoteBase.exitCode !== 0) return {status: "blocked", reason: `base branch does not exist: ${baseBranch}`};
      if (ctx.config.delivery?.mode === "pull-request" && !hasRemote) return {status: "blocked", reason: "pull-request delivery requires configured remote"};
      const resolvedBase = localBase.exitCode === 0 ? localBase : remoteBase;
      const provisioning = await detectProvisioning(ctx.repositoryRoot, fs);
      let environmentFiles = [];
      if (ctx.config.provisioning.copy_env_files) {
        try {
          environmentFiles = await discoverEnvironmentFiles(ctx.repositoryRoot, command);
        } catch (error) {
          return {status: "blocked", reason: error.message};
        }
      }
      preflightResult = {schema_version: 1, run_id: ctx.runId, repository_root: ctx.repositoryRoot, starting_sha: sha.stdout.trim(), base_sha: resolvedBase.stdout.trim(), current_branch: branch.stdout.trim(), remote: hasRemote ? remoteName : null, has_remote: hasRemote, base_branch: baseBranch, provisioning, environment_files: environmentFiles, status: "ready"};
      await atomicWrite(fs, path.join(ctx.runDir, "preflight", "preflight.json"), preflightResult);
      return preflightResult;
    },

    async createWorkspace({preflight}) {
      const branch = `${ctx.config.git?.branch_prefix ?? "daddy/wip-"}${ctx.runId}`;
      const root = path.resolve(expandHome(ctx.config.paths?.worktree_root ?? "~/.local/state/opencode/daddy/worktrees"));
      const worktreePath = path.join(root, ctx.runId, "integration");
      await fs.mkdir(path.dirname(worktreePath), {recursive: true});
      const result = await git(["worktree", "add", "-b", branch, worktreePath, preflight.base_sha]);
      if (result.exitCode !== 0) throw new Error(`integration worktree creation failed: ${result.stderr}`);
      workspaceResult = {branch, path: worktreePath, provisioned: false};
      worktrees.add(worktreePath);
      const provisioning = await provision(workspaceResult, path.join(ctx.runDir, "preflight", "integration-provisioning.json"), 1);
      if (provisioning.status === "blocked") return {...workspaceResult, status: "blocked", reason: provisioningReason(provisioning), provisioning};
      await state("running");
      return workspaceResult;
    },

    async runNode({node, input, depth}) {
      const nodeId = nodeIdentity(node, depth);
      let error;
      for (let attempt = 1; attempt <= ctx.config.runtime.node_retries + 1; attempt += 1) {
        try { return await harness({node, nodeId, model: modelFor(node), cwd: workspaceResult.path, input, attempt}); } catch (caught) { error = caught; }
      }
      throw error;
    },

    async runWorker({item, model, depth, attempt, request, context}) {
      const nodeId = nodeIdentity("worker", depth, item);
      let worker = workers.get(nodeId);
      if (!worker) {
        const scope = depth ? `issue-${depth}` : "sdlc";
        const branch = `${workspaceResult.branch}-${scope}-${safePart(item.id, "item ID")}`;
        const workerPath = path.join(path.dirname(workspaceResult.path), `worker-${scope}-${item.id}`);
        const head = await git(["rev-parse", "HEAD"], workspaceResult.path);
        if (head.exitCode !== 0) throw new Error("cannot resolve integration HEAD");
        const made = await git(["worktree", "add", "-b", branch, workerPath, head.stdout.trim()]);
        if (made.exitCode !== 0) throw new Error(`worker worktree creation failed: ${made.stderr}`);
        worker = {branch, path: workerPath, nodeId, provisioned: false};
        workers.set(nodeId, worker);
        worktrees.add(workerPath);
      }
      const provisioning = await provision(worker, path.join(ctx.runDir, "nodes", nodeId, String(attempt), "provisioning.json"), attempt);
      if (provisioning.status === "blocked") throw Object.assign(new Error(`worker dependency provisioning infrastructure blocked: ${provisioningReason(provisioning)}`), {evidence: provisioning});
      return await harness({node: "worker", nodeId, model, cwd: worker.path, input: {request, context, item, depth}, item, attempt});
    },

    async integrate({item, worker, depth}) {
      const entry = workers.get(nodeIdentity("worker", depth, item));
      if (!entry) return {outcome: "blocked", reason: "worker worktree is unavailable"};
      const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], entry.path);
      if (status.exitCode !== 0) return {outcome: "blocked", reason: status.stderr};
      const changed = porcelainPaths(status.stdout);
      const reported = [...worker.changed_paths].sort();
      if (JSON.stringify(changed) !== JSON.stringify(reported)) return {outcome: "failure", reason: "worker changed paths do not match Git"};
      const allowed = item.affected_paths;
      if (changed.some((changedPath) => !allowed.some((declared) => declared.endsWith("/") ? changedPath.startsWith(declared) : changedPath === declared))) {
        return {outcome: "failure", reason: "worker changed path is outside affected_paths"};
      }
      for (const validation of item.validation_commands) {
        const result = await command("bash", ["-lc", validation], {cwd: entry.path});
        if (INFRASTRUCTURE_EXIT_CODES.has(result.exitCode)) {
          const evidence = {schema_version: 1, run_id: ctx.runId, node_id: entry.nodeId, item_id: item.id, status: "blocked", outcome: "blocked", reason: "item validation infrastructure blocked", validation: {command: validation, exit_code: result.exitCode, stdout: result.stdout, stderr: result.stderr}};
          await atomicWrite(fs, path.join(path.dirname(worker.outputPath), "item-validation.json"), evidence);
          return {outcome: "blocked", reason: evidence.reason, evidence};
        }
        if (result.exitCode !== 0) return {outcome: "failure", reason: "item validation failed", evidence: result};
      }
      if (!changed.length) return {outcome: "failure", reason: "worker produced no changes"};
      const added = await git(["add", "--all"], entry.path);
      const committed = added.exitCode === 0 ? await git(["commit", "-m", `daddy: ${item.title}`], entry.path) : added;
      if (committed.exitCode !== 0) return {outcome: "failure", reason: "worker commit failed", evidence: committed};
      const sha = await git(["rev-parse", "HEAD"], entry.path);
      if (sha.exitCode !== 0) return {outcome: "blocked", reason: "cannot resolve worker commit"};
      const picked = await git(["cherry-pick", sha.stdout.trim()], workspaceResult.path);
      if (picked.exitCode !== 0) {
        await git(["cherry-pick", "--abort"], workspaceResult.path);
        return {outcome: "failure", reason: "cherry-pick conflict", evidence: picked};
      }
      const removed = await removeWorktree(entry, true);
      if (!removed) return {outcome: "blocked", reason: "worker worktree cleanup failed"};
      workers.delete(entry.nodeId);
      return {outcome: "success", commit: sha.stdout.trim()};
    },

    async verify({plan, depth, validationCommands = plan.final_validation_commands}) {
      const before = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], workspaceResult.path);
      if (before.exitCode !== 0 || before.stdout) return {outcome: "blocked", reason: "verification requires a clean integration worktree"};
      const results = [];
      for (const validation of validationCommands) {
        const result = await command("bash", ["-lc", validation], {cwd: workspaceResult.path});
        results.push({command: validation, exit_code: result.exitCode, stdout: result.stdout, stderr: result.stderr});
        if (INFRASTRUCTURE_EXIT_CODES.has(result.exitCode)) break;
      }
      const after = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], workspaceResult.path);
      if (after.exitCode !== 0 || after.stdout) return {outcome: "blocked", reason: "validation commands mutated the integration worktree"};
      const head = await git(["rev-parse", "HEAD"], workspaceResult.path);
      if (head.exitCode !== 0) return {outcome: "blocked", reason: "verified commit is unavailable"};
      const outcome = results.some((result) => INFRASTRUCTURE_EXIT_CODES.has(result.exit_code)) ? "blocked" : results.every((result) => result.exit_code === 0) ? "success" : "failure";
      const summary = outcome === "success" ? "All validation commands passed" : outcome === "blocked" ? "Validation command infrastructure blocked" : "Validation commands failed";
      const value = {schema_version: 1, run_id: ctx.runId, node_id: depth ? `issue.${depth}.verify` : "sdlc.verify", status: outcome, outcome, summary, results, verified_commit: head.stdout.trim()};
      const directory = path.join(ctx.runDir, "nodes", value.node_id, "1");
      await fs.mkdir(directory, {recursive: true});
      await atomicWrite(fs, path.join(directory, "output.json"), value);
      return value;
    },

    async ship({verification} = {}) {
      await state("shipping");
      if (verification?.outcome !== "success") return await adapter.halt({reason: "ship requires successful verification", node: "ship", depth: 0});
      const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], workspaceResult.path);
      if (status.exitCode !== 0) return await adapter.halt({reason: "ship Git status failed", node: "ship", depth: 0});
      if (status.stdout) return await adapter.halt({reason: "integration worktree mutated after verification", node: "ship", depth: 0});
      const sha = await git(["rev-parse", "HEAD"], workspaceResult.path);
      if (sha.exitCode !== 0) return await adapter.halt({reason: "final commit unavailable", node: "ship", depth: 0});
      if (!verification?.verified_commit || sha.stdout.trim() !== verification.verified_commit) return await adapter.halt({reason: "integration HEAD differs from verified commit", node: "ship", depth: 0});
      let mode = ctx.config.delivery?.mode ?? "adaptive";
      if (mode === "adaptive") mode = preflightResult.has_remote ? (ctx.config.delivery?.with_remote ?? "pull-request") : (ctx.config.delivery?.no_remote ?? "local-branch");
      if (mode === "pull-request" && !preflightResult.has_remote) return await adapter.halt({reason: "pull-request delivery requires configured remote", node: "ship", depth: 0});
      let url = null;
      const pending = {schema_version: 1, run_id: ctx.runId, status: "pending", mode, branch: workspaceResult.branch, commit: sha.stdout.trim(), verified_commit: verification.verified_commit, base_branch: preflightResult.base_branch, remote: preflightResult.remote};
      await atomicWrite(fs, path.join(ctx.runDir, "delivery", "pending.json"), pending);
      if (mode === "pull-request") {
        const pushed = await git(["push", "-u", preflightResult.remote, workspaceResult.branch], workspaceResult.path);
        if (pushed.exitCode !== 0) return await adapter.halt({reason: "push failed", node: "ship", depth: 0});
        const pr = await command("gh", ["pr", "create", "--base", preflightResult.base_branch, "--head", workspaceResult.branch, "--title", `Daddy run ${ctx.runId}`, "--body", "Automated, deterministically verified Daddy run.", ...(ctx.config.delivery?.draft_pull_request ? ["--draft"] : [])], {cwd: workspaceResult.path});
        if (pr.exitCode !== 0) return await adapter.halt({reason: "pull request creation failed", node: "ship", depth: 0});
        url = pr.stdout.trim().split(/\s+/).at(-1);
      } else if (!["local-branch", "none"].includes(mode)) {
        return await adapter.halt({reason: `unsupported delivery mode: ${mode}`, node: "ship", depth: 0});
      }
      const removed = await cleanupAll();
      if (!removed) return await adapter.halt({reason: "delivery cleanup failed", node: "ship", depth: 0});
      const delivery = {schema_version: 1, run_id: ctx.runId, status: "delivered", mode, branch: workspaceResult.branch, commit: sha.stdout.trim(), verified_commit: verification.verified_commit, base_branch: preflightResult.base_branch, remote: preflightResult.remote, pull_request_url: url, worktrees_removed: true};
      await atomicWrite(fs, path.join(ctx.runDir, "delivery", "ship.json"), delivery);
      await state("delivered");
      return delivery;
    },

    async halt({reason, node, depth = 0}) {
      await atomicWrite(fs, path.join(ctx.runDir, "halted", "pending.json"), {schema_version: 1, run_id: ctx.runId, status: "pending", reason, node_id: node ?? null, issue_depth: depth});
      let checkpointCommit = null;
      let checkpointFailed = false;
      const workerCheckpoints = [];
      for (const worker of workers.values()) {
        const saved = await checkpoint(worker, `daddy: worker checkpoint ${ctx.runId} ${worker.nodeId}`);
        if (saved) workerCheckpoints.push(saved);
        else { checkpointFailed = true; worktrees.delete(worker.path); }
      }
      if (workspaceResult && worktrees.has(workspaceResult.path)) {
        checkpointCommit = (await checkpoint(workspaceResult, `daddy: checkpoint ${ctx.runId}`))?.commit ?? null;
        if (!checkpointCommit) { checkpointFailed = true; worktrees.delete(workspaceResult.path); }
      }
      const removed = await cleanupAll() && !checkpointFailed;
      const halt = {schema_version: 1, run_id: ctx.runId, status: "halted", reason, node_id: node ?? null, issue_depth: depth, checkpoint_branch: workspaceResult?.branch ?? null, checkpoint_commit: checkpointCommit, worker_checkpoints: workerCheckpoints, worktrees_removed: removed};
      await atomicWrite(fs, path.join(ctx.runDir, "halted", "halt.json"), halt);
      await state("halted", {issue_depth: depth});
      return halt;
    },

    async cleanup() { await cleanupAll(); },
    record(event) { return state(event.type === "shipping" ? "shipping" : "running", {issue_depth: event.depth ?? 0, current_nodes: event.node ? [event.node] : []}, event); },
    flushRecords,
  };
  return adapter;
}

export async function runPreparedRun(context, dependencies = {}) {
  const fs = dependencies.fs ?? nodeFs;
  const request = await fs.readFile(context.requestPath, "utf8");
  if (!request.trim()) throw new Error("request file must be non-empty");
  await atomicWrite(fs, path.join(context.runDir, "request", "request.json"), {schema_version: 1, run_id: context.runId, request, invocation_directory: context.metadata?.invocation_directory ?? context.invocationDirectory});
  const adapter = createRuntimeAdapter(context, dependencies);
  try {
    return await runDag({config: context.config, request, adapter, record: (event) => { adapter.record(event); }});
  } finally {
    await adapter.flushRecords();
  }
}
