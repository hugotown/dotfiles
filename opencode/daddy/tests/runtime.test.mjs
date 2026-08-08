import test from "node:test";
import assert from "node:assert/strict";
import {promises as fs} from "node:fs";
import {homedir, tmpdir} from "node:os";
import path from "node:path";
import YAML from "yaml";
import {copyEnvironmentFile, createRuntimeAdapter, detectProvisioning, execute, loadConfig, prepareRun, runPreparedRun} from "../src/runtime.mjs";

const git = async (repo, ...args) => {
  const result = await execute("git", args, {cwd: repo});
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout.trim();
};

const repository = async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-repo-"));
  await git(root, "init", "-b", "main");
  await git(root, "config", "user.email", "daddy@example.test");
  await git(root, "config", "user.name", "Daddy Test");
  await fs.writeFile(path.join(root, "README.md"), "initial\n");
  await git(root, "add", "README.md");
  await git(root, "commit", "-m", "initial");
  return root;
};

const config = (root, overrides = {}) => ({
  version: 1,
  paths: {run_root: path.join(root, "runs"), worktree_root: path.join(root, "worktrees")},
  runtime: {max_issue_depth: 3, node_retries: 0, command_timeout_seconds: 5, startup_timeout_seconds: 1, node_timeout_seconds: 1, poll_interval_seconds: 1, require_idle_status: true},
  build: {max_concurrency: 2, max_items: 8},
  provisioning: {copy_env_files: true},
  git: {branch_prefix: "daddy/wip-", base_branch: "auto", remote: "origin"},
  delivery: {mode: "adaptive", no_remote: "local-branch", with_remote: "pull-request", draft_pull_request: false},
  models: {intent: "test/intent-model", spec_design: "test/spec-model", plan: "test/plan-model", rca: "test/rca-model", issue_plan: "test/issue-model", worker_high: "test/high-model", worker_mid: "test/mid-model", worker_low: "test/low-model"},
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
  ...overrides,
});

const common = (runId, nodeId, outcome = "success") => ({schema_version: 1, run_id: runId, node_id: nodeId, status: outcome === "blocked" ? "blocked" : "success", outcome, summary: nodeId, artifacts: []});
const item = (id = "change") => ({id, title: "Make change", objective: "change file", complexity: "low", depends_on: [], acceptance_criteria: ["file exists"], affected_paths: ["made.txt"], validation_commands: ["test -f made.txt"]});
const plan = (runId, nodeId, work = item()) => ({...common(runId, nodeId), items: [work], final_validation_commands: ["test -f made.txt"]});

const fakeHarness = (responses, calls = []) => {
  let pane = 0;
  const paneCwds = new Map();
  return async (program, args, options = {}) => {
    calls.push({program, args, cwd: options.cwd, timeout: options.timeout});
    if (program === "git" || program === "bash") return await execute(program, args, options);
    if (program === "gh") return {exitCode: 0, stdout: "https://example.test/pr/1\n", stderr: ""};
    assert.equal(program, "herdr");
    if (args[0] === "workspace") {
      const paneId = `pane-${++pane}`;
      paneCwds.set(paneId, args[args.indexOf("--cwd") + 1]);
      return {exitCode: 0, stdout: JSON.stringify({result: {root_pane: {pane_id: paneId}}}), stderr: ""};
    }
    if (args[0] === "pane" && args[1] === "send-text" && !args[3].startsWith("opencode ")) {
      const prompt = args[3];
      const outputPath = prompt.match(/Write strict JSON to `([^`]+)\.tmp`/)[1];
      const completePath = prompt.match(/create `([^`]+)`[^\n]*(?:final|last)/i)[1];
      const nodeId = prompt.match(/`node_id: "([^"]+)"`/)[1];
      const response = responses.shift();
      const output = await response({nodeId, cwd: paneCwds.get(args[2]), prompt});
      await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`);
      await fs.writeFile(completePath, "");
    }
    return {exitCode: 0, stdout: "", stderr: ""};
  };
};

const faultable = (base, fault) => async (program, args, options) => {
  if (fault.current && fault.current.match(program, args, options)) {
    const result = fault.current.result;
    fault.current = null;
    return result;
  }
  return await base(program, args, options);
};

const nonzero = (stderr = "injected failure") => ({exitCode: 1, stdout: "", stderr});

const prepared = async (repo, cfg, runId = "run-1") => {
  const value = await prepareRun({repo, config: cfg, id: () => runId, clock: {now: () => new Date("2026-07-26T00:00:00.000Z")}});
  await fs.writeFile(value.requestPath, "Build the requested file safely.\n");
  return value;
};

const addPackageFiles = async (repo, files, manifest = {}) => {
  await fs.writeFile(path.join(repo, "package.json"), `${JSON.stringify(manifest)}\n`);
  for (const file of files) await fs.writeFile(path.join(repo, file), "lock\n");
  await git(repo, "add", "package.json", ...files);
  await git(repo, "commit", "-m", "package metadata");
};

test("default executor captures output, spawn errors, and bounded termination", async () => {
  const captured = await execute(process.execPath, ["-e", "process.stdout.write('out'); process.stderr.write('err')"]);
  assert.deepEqual(captured, {stdout: "out", stderr: "err", exitCode: 0});
  await assert.rejects(execute("daddy-command-that-does-not-exist", []));
  const timedOut = await execute(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {timeout: 10});
  assert.notEqual(timedOut.exitCode, 0);
});

test("loadConfig parses YAML, validates it, and expands home paths", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-config-"));
  const cfg = config(root);
  cfg.paths.run_root = "~/daddy-test-runs";
  const file = path.join(root, "config.yaml");
  const yaml = YAML.stringify(cfg).replace(cfg.paths.run_root, "~/daddy-test-runs");
  await fs.writeFile(file, yaml);
  const loaded = await loadConfig(file);
  assert.equal(loaded.paths.run_root, path.join(homedir(), "daddy-test-runs"));
  await fs.writeFile(file, yaml.replace("~/daddy-test-runs", "'~'"));
  assert.equal((await loadConfig(file)).paths.run_root, homedir());
  await assert.rejects(loadConfig(path.join(root, "missing.yaml")));
});

test("dependency provisioning detection honors packageManager then deterministic lockfile precedence", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-detection-"));
  const expected = {
    bun: ["bun", ["install", "--frozen-lockfile"]],
    pnpm: ["pnpm", ["install", "--frozen-lockfile"]],
    yarn: ["yarn", ["install", "--immutable"]],
    npm: ["npm", ["ci"]],
  };
  for (const manager of Object.keys(expected)) {
    const directory = path.join(root, `declared-${manager}`);
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({packageManager: `${manager}@1.2.3`}));
    await fs.writeFile(path.join(directory, "bun.lock"), "lock");
    const result = await detectProvisioning(directory);
    assert.deepEqual([result.program, result.args], expected[manager]);
  }
  const locks = [["bun.lock", "bun"], ["bun.lockb", "bun"], ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"]];
  for (const [lockfile, manager] of locks) {
    const directory = path.join(root, lockfile.replaceAll(".", "-"));
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, lockfile), "lock");
    assert.equal((await detectProvisioning(directory)).strategy, manager);
  }
  const precedence = path.join(root, "precedence");
  await fs.mkdir(precedence);
  await fs.writeFile(path.join(precedence, "package.json"), JSON.stringify({packageManager: "unknown@1", scripts: {check: "ultracite check"}}));
  for (const [lockfile] of locks) await fs.writeFile(path.join(precedence, lockfile), "lock");
  assert.equal((await detectProvisioning(precedence)).strategy, "bun");
  const none = path.join(root, "none");
  await fs.mkdir(none);
  await fs.writeFile(path.join(none, "package.json"), "not json");
  assert.deepEqual(await detectProvisioning(none), {strategy: "none", program: null, args: []});
});

test("preflight discovers only ignored non-template environment files and copies all of them before integration and worker installs", async () => {
  const repo = await repository();
  await addPackageFiles(repo, ["bun.lock"]);
  await fs.writeFile(path.join(repo, ".gitignore"), ".env*\nnested/.env*\nservices/api/.env*\n");
  await git(repo, "add", ".gitignore");
  await git(repo, "commit", "-m", "ignore local environment");
  await fs.mkdir(path.join(repo, "nested"));
  await fs.mkdir(path.join(repo, "services", "api"), {recursive: true});
  const selected = [".env", "nested/.env.local", "services/api/.env.production"];
  for (const relative of selected) await fs.writeFile(path.join(repo, relative), `DADDY_FIXTURE_${path.basename(relative).length}=fixture-only\n`);
  await fs.chmod(path.join(repo, ".env"), 0o640);
  for (const relative of [".env.example", ".env.sample.local", ".env.production.template", ".envrc"]) await fs.writeFile(path.join(repo, relative), "fixture-template\n");
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "env-copy");
  const calls = [];
  const response = async ({nodeId, cwd}) => {
    for (const relative of selected) await fs.access(path.join(cwd, relative));
    await fs.writeFile(path.join(cwd, "made.txt"), "made\n");
    return {...common(run.runId, nodeId), item_id: "change", changed_paths: ["made.txt"]};
  };
  const base = fakeHarness([response], calls);
  const executor = async (program, args, options) => {
    if (program !== "bun") return await base(program, args, options);
    for (const relative of selected) await fs.access(path.join(options.cwd, relative));
    calls.push({program, args, cwd: options.cwd});
    return {exitCode: 0, stdout: "installed", stderr: ""};
  };
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: executor});
  const preflight = await adapter.preflight();
  assert.deepEqual(preflight.environment_files, selected);
  assert.equal(calls.some((call) => call.program === "git" && JSON.stringify(call.args) === JSON.stringify(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]) && call.cwd === repo), true);
  const workspace = await adapter.createWorkspace({preflight});
  assert.equal((await fs.stat(path.join(workspace.path, ".env"))).mode & 0o777, 0o640);
  await adapter.runWorker({item: item(), model: "test/low", depth: 0, attempt: 1});
  assert.equal(calls.filter((call) => call.program === "bun").length, 2);
  for (const artifact of [path.join(run.runDir, "preflight", "integration-provisioning.json"), path.join(run.runDir, "nodes", "sdlc.build.change", "1", "provisioning.json")]) {
    const body = await fs.readFile(artifact, "utf8");
    assert.doesNotMatch(body, /DADDY_FIXTURE|fixture-only/);
    assert.deepEqual(JSON.parse(body).environment_files, selected.map((relative) => ({path: relative, status: "copied"})));
  }
  await adapter.cleanup();
});

test("disabled environment copying skips discovery and leaves worktrees without ignored files", async () => {
  const repo = await repository();
  await fs.writeFile(path.join(repo, ".gitignore"), ".env\n");
  await git(repo, "add", ".gitignore");
  await git(repo, "commit", "-m", "ignore env");
  await fs.writeFile(path.join(repo, ".env"), "DADDY_DISABLED_FIXTURE=fixture-only\n");
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const cfg = config(root, {provisioning: {copy_env_files: false}});
  const run = await prepared(repo, cfg, "env-disabled");
  const calls = [];
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness([], calls)});
  const preflight = await adapter.preflight();
  assert.deepEqual(preflight.environment_files, []);
  assert.equal(calls.some((call) => call.args?.[0] === "ls-files"), false);
  const workspace = await adapter.createWorkspace({preflight});
  await assert.rejects(fs.access(path.join(workspace.path, ".env")));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(run.runDir, "preflight", "integration-provisioning.json"), "utf8")).environment_files, []);
  await adapter.cleanup();
});

test("environment provisioning blocks unsafe discovery, traversal, symlinks, copy, and permission failures with path-only evidence", async () => {
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  for (const [name, unsafe] of [["absolute", "/tmp/.env"], ["traversal", "../.env"]]) {
    const repo = await repository();
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, `env-${name}`);
    const base = fakeHarness([]);
    const executor = async (program, args, options) => program === "git" && args[0] === "ls-files" ? {exitCode: 0, stdout: `${unsafe}\0`, stderr: ""} : await base(program, args, options);
    const result = await createRuntimeAdapter({...run, config: cfg}, {execute: executor}).preflight();
    assert.equal(result.status, "blocked");
    assert.match(result.reason, /unsafe path/);
  }
  {
    const repo = await repository();
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, "env-discovery-failed");
    const base = fakeHarness([]);
    const executor = async (program, args, options) => program === "git" && args[0] === "ls-files" ? {exitCode: 2, stdout: "", stderr: "unavailable"} : await base(program, args, options);
    const result = await createRuntimeAdapter({...run, config: cfg}, {execute: executor}).preflight();
    assert.equal(result.status, "blocked");
    assert.match(result.reason, /discovery failed/);
  }

  for (const failure of ["symlink", "copy", "chmod", "traversal-after-preflight"]) {
    const repo = await repository();
    await fs.writeFile(path.join(repo, ".gitignore"), ".env\n");
    await git(repo, "add", ".gitignore");
    await git(repo, "commit", "-m", "ignore env");
    const source = path.join(repo, ".env");
    if (failure === "symlink") await fs.symlink(path.join(repo, "README.md"), source);
    else await fs.writeFile(source, "DADDY_FAILURE_FIXTURE=fixture-only\n");
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, `env-failure-${failure}`);
    const failingFs = failure === "copy" ? {...fs, async copyFile() { throw new Error("copy denied"); }}
      : failure === "chmod" ? {...fs, async chmod() { throw new Error("chmod denied"); }} : fs;
    const adapter = createRuntimeAdapter({...run, config: cfg}, {fs: failingFs});
    const preflight = await adapter.preflight();
    if (failure === "traversal-after-preflight") preflight.environment_files = ["../.env"];
    const blocked = await adapter.createWorkspace({preflight});
    assert.equal(blocked.status, "blocked", failure);
    const body = await fs.readFile(path.join(run.runDir, "preflight", "integration-provisioning.json"), "utf8");
    assert.doesNotMatch(body, /DADDY_FAILURE_FIXTURE|fixture-only|copy denied|chmod denied/);
    const evidence = JSON.parse(body);
    assert.equal(evidence.status, "blocked");
    assert.equal(evidence.environment_files.at(-1).status, "blocked");
    await adapter.cleanup();
  }

  {
    const repo = await repository();
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, "env-root-read-failure");
    const failingFs = {...fs, async realpath(target) {
      if (path.basename(target) === "integration") throw new Error("root unavailable");
      return await fs.realpath(target);
    }};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {fs: failingFs});
    const preflight = await adapter.preflight();
    const blocked = await adapter.createWorkspace({preflight});
    assert.equal(blocked.status, "blocked");
    const body = await fs.readFile(path.join(run.runDir, "preflight", "integration-provisioning.json"), "utf8");
    assert.match(body, /copy safety check failed/);
    assert.doesNotMatch(body, /root unavailable/);
    await adapter.cleanup();
  }
});

test("environment copy rejects unsafe parent, source, destination, and post-copy filesystem states", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-env-safety-"));
  const sourceRoot = path.join(root, "source");
  const destinationRoot = path.join(root, "destination");
  const outside = path.join(root, "outside");
  await fs.mkdir(sourceRoot);
  await fs.mkdir(destinationRoot);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(sourceRoot, ".env"), "DADDY_SAFETY_FIXTURE=fixture-only\n");
  await fs.mkdir(path.join(sourceRoot, "nested"));
  await fs.writeFile(path.join(sourceRoot, "nested", ".env"), "nested fixture\n");

  await fs.mkdir(path.join(destinationRoot, "existing"));
  await fs.mkdir(path.join(sourceRoot, "existing"));
  await fs.writeFile(path.join(sourceRoot, "existing", ".env"), "existing fixture\n");
  await fs.writeFile(path.join(destinationRoot, "existing", ".env"), "old fixture\n");
  await copyEnvironmentFile(fs, sourceRoot, destinationRoot, "existing/.env");

  const parentErrorFs = {...fs, async lstat(target) {
    if (target === path.join(destinationRoot, "nested")) throw Object.assign(new Error("denied"), {code: "EACCES"});
    return await fs.lstat(target);
  }};
  await assert.rejects(copyEnvironmentFile(parentErrorFs, sourceRoot, destinationRoot, "nested/.env"), /denied/);

  await fs.symlink(outside, path.join(destinationRoot, "linked-parent"));
  await fs.mkdir(path.join(sourceRoot, "linked-parent"));
  await fs.writeFile(path.join(sourceRoot, "linked-parent", ".env"), "linked fixture\n");
  await assert.rejects(copyEnvironmentFile(fs, sourceRoot, destinationRoot, "linked-parent/.env"), /unsafe destination parent/);

  await fs.writeFile(path.join(destinationRoot, "file-parent"), "not a directory\n");
  await fs.mkdir(path.join(sourceRoot, "file-parent"));
  await fs.writeFile(path.join(sourceRoot, "file-parent", ".env"), "file fixture\n");
  await assert.rejects(copyEnvironmentFile(fs, sourceRoot, destinationRoot, "file-parent/.env"), /unsafe destination parent/);

  await fs.mkdir(path.join(destinationRoot, "escaped-parent"));
  await fs.mkdir(path.join(sourceRoot, "escaped-parent"));
  await fs.writeFile(path.join(sourceRoot, "escaped-parent", ".env"), "escaped fixture\n");
  const escapedParentFs = {...fs, async realpath(target) {
    if (target === path.join(destinationRoot, "escaped-parent")) return outside;
    return await fs.realpath(target);
  }};
  await assert.rejects(copyEnvironmentFile(escapedParentFs, sourceRoot, destinationRoot, "escaped-parent/.env"), /escapes worktree/);

  await fs.writeFile(path.join(outside, ".env"), "outside fixture\n");
  await fs.symlink(outside, path.join(sourceRoot, "source-link"));
  await assert.rejects(copyEnvironmentFile(fs, sourceRoot, destinationRoot, "source-link/.env"), /source escapes repository/);

  await fs.symlink(path.join(outside, ".env"), path.join(destinationRoot, ".env"));
  await assert.rejects(copyEnvironmentFile(fs, sourceRoot, destinationRoot, ".env"), /destination is not a regular file/);
  await fs.unlink(path.join(destinationRoot, ".env"));
  await fs.mkdir(path.join(destinationRoot, ".env"));
  await assert.rejects(copyEnvironmentFile(fs, sourceRoot, destinationRoot, ".env"), /destination is not a regular file/);
  await fs.rmdir(path.join(destinationRoot, ".env"));

  const destinationErrorFs = {...fs, async lstat(target) {
    if (target === path.join(destinationRoot, ".env")) throw Object.assign(new Error("destination denied"), {code: "EACCES"});
    return await fs.lstat(target);
  }};
  await assert.rejects(copyEnvironmentFile(destinationErrorFs, sourceRoot, destinationRoot, ".env"), /destination denied/);

  let destinationStats = 0;
  const replacedFs = {...fs, async lstat(target) {
    if (target === path.join(destinationRoot, ".env") && ++destinationStats === 2) return {isSymbolicLink: () => true};
    return await fs.lstat(target);
  }};
  await copyEnvironmentFile(fs, sourceRoot, destinationRoot, ".env");
  await assert.rejects(copyEnvironmentFile(replacedFs, sourceRoot, destinationRoot, ".env"), /destination escapes worktree/);

  const escapedDestinationFs = {...fs, async realpath(target) {
    if (target === path.join(destinationRoot, ".env")) return path.join(outside, ".env");
    return await fs.realpath(target);
  }};
  await assert.rejects(copyEnvironmentFile(escapedDestinationFs, sourceRoot, destinationRoot, ".env"), /destination escapes worktree/);
});

test("integration and worker Bun provisioning is direct, bounded, evidenced, and one-time", async () => {
  const repo = await repository();
  await addPackageFiles(repo, ["bun.lock"], {scripts: {check: "ultracite check"}});
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "bun-ultracite");
  const calls = [];
  const response = async ({nodeId, cwd}) => {
    await fs.writeFile(path.join(cwd, "made.txt"), "made\n");
    return {...common(run.runId, nodeId), item_id: "change", changed_paths: ["made.txt"]};
  };
  const base = fakeHarness([async () => ({bad: true}), response], calls);
  const executor = async (program, args, options) => {
    if (program === "bun") {
      calls.push({program, args, cwd: options.cwd, timeout: options.timeout});
      await fs.mkdir(path.join(options.cwd, "node_modules", ".bin"), {recursive: true});
      await fs.writeFile(path.join(options.cwd, "node_modules", ".bin", "ultracite"), "installed");
      return {exitCode: 0, stdout: "installed ultracite\n", stderr: "bun warning\n"};
    }
    return await base(program, args, options);
  };
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: executor});
  const preflight = await adapter.preflight();
  assert.deepEqual(preflight.provisioning, {strategy: "bun", program: "bun", args: ["install", "--frozen-lockfile"]});
  const workspace = await adapter.createWorkspace({preflight});
  await assert.rejects(adapter.runWorker({item: item(), model: "test/low", depth: 0, attempt: 1}), /malformed contract/);
  assert.equal((await adapter.runWorker({item: item(), model: "test/low", depth: 0, attempt: 2})).outcome, "success");
  const installs = calls.filter((call) => call.program === "bun");
  assert.equal(installs.length, 2);
  assert.deepEqual(installs.map((call) => call.args), [["install", "--frozen-lockfile"], ["install", "--frozen-lockfile"]]);
  assert.equal(installs.every((call) => call.timeout === 5000), true);
  assert.notEqual(installs[0].cwd, installs[1].cwd);
  const integrationEvidence = JSON.parse(await fs.readFile(path.join(run.runDir, "preflight", "integration-provisioning.json"), "utf8"));
  assert.deepEqual([integrationEvidence.stdout, integrationEvidence.stderr, integrationEvidence.exitCode], ["installed ultracite\n", "bun warning\n", 0]);
  const workerEvidence = JSON.parse(await fs.readFile(path.join(run.runDir, "nodes", "sdlc.build.change", "1", "provisioning.json"), "utf8"));
  assert.equal(workerEvidence.status, "success");
  assert.equal(workspace.provisioned, true);
  await adapter.cleanup();
});

test("provisioning failures retain tracked worktrees, preserve raw evidence, and retry workers", async () => {
  const repo = await repository();
  await addPackageFiles(repo, ["bun.lock"]);
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const cfg = config(stateRoot);
  let run = await prepared(repo, cfg, "integration-install-fail");
  let base = fakeHarness([]);
  let executor = async (program, args, options) => program === "bun" ? {exitCode: 42, stdout: "partial\n", stderr: "network down\n"} : await base(program, args, options);
  let adapter = createRuntimeAdapter({...run, config: cfg}, {execute: executor});
  let preflight = await adapter.preflight();
  const blocked = await adapter.createWorkspace({preflight});
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.reason, /exitCode=42.*partial.*network down/);
  await fs.access(blocked.path);
  const evidence = JSON.parse(await fs.readFile(path.join(run.runDir, "preflight", "integration-provisioning.json"), "utf8"));
  assert.deepEqual([evidence.stdout, evidence.stderr, evidence.exitCode], ["partial\n", "network down\n", 42]);
  await adapter.cleanup();

  run = await prepared(repo, cfg, "worker-install-retry");
  let workerInstalls = 0;
  const response = async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "made\n"); return {...common(run.runId, nodeId), item_id: "change", changed_paths: ["made.txt"]}; };
  base = fakeHarness([response]);
  executor = async (program, args, options) => {
    if (program !== "bun") return await base(program, args, options);
    if (path.basename(options.cwd).startsWith("worker-")) {
      workerInstalls += 1;
      if (workerInstalls === 1) return {exitCode: 9, stdout: "retry stdout", stderr: "retry stderr"};
    }
    return {exitCode: 0, stdout: "ok", stderr: ""};
  };
  adapter = createRuntimeAdapter({...run, config: cfg}, {execute: executor});
  preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  await assert.rejects(adapter.runWorker({item: item(), model: "test/low", depth: 0, attempt: 1}), /exitCode=9.*retry stdout.*retry stderr/);
  assert.equal((await adapter.runWorker({item: item(), model: "test/low", depth: 0, attempt: 2})).outcome, "success");
  assert.equal(workerInstalls, 2);
  const firstAttempt = JSON.parse(await fs.readFile(path.join(run.runDir, "nodes", "sdlc.build.change", "1", "provisioning.json"), "utf8"));
  assert.equal(firstAttempt.status, "blocked");
  assert.equal(firstAttempt.exitCode, 9);
  await adapter.cleanup();
});

test("provisioning blocks tracked lockfile mutation but permits ignored dependencies", async () => {
  const repo = await repository();
  await addPackageFiles(repo, ["bun.lock"]);
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "install-mutation");
  const base = fakeHarness([]);
  const executor = async (program, args, options) => {
    if (program === "bun") {
      await fs.writeFile(path.join(options.cwd, "bun.lock"), "mutated\n");
      await fs.mkdir(path.join(options.cwd, "node_modules"));
      return {exitCode: 0, stdout: "installed", stderr: ""};
    }
    return await base(program, args, options);
  };
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: executor});
  const preflight = await adapter.preflight();
  const blocked = await adapter.createWorkspace({preflight});
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.reason, /modified tracked files/);
  assert.match(blocked.provisioning.tracked_status.stdout, /bun.lock/);
  await adapter.cleanup();

  const statusRun = await prepared(repo, cfg, "install-status-failure");
  const statusExecutor = async (program, args, options) => {
    if (program === "bun") return {exitCode: 0, stdout: "installed", stderr: ""};
    if (program === "git" && args[0] === "status" && args.includes("--untracked-files=no")) return {exitCode: 2, stdout: "", stderr: "status unavailable"};
    return await base(program, args, options);
  };
  const statusAdapter = createRuntimeAdapter({...statusRun, config: cfg}, {execute: statusExecutor});
  const statusPreflight = await statusAdapter.preflight();
  const statusBlocked = await statusAdapter.createWorkspace({preflight: statusPreflight});
  assert.equal(statusBlocked.status, "blocked");
  assert.match(statusBlocked.reason, /Git status failed.*status unavailable/);
  await statusAdapter.cleanup();
});

test("prepareRun creates an external atomic layout and rejects unsafe IDs", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg);
  assert.equal(run.runDir.startsWith(repo), false);
  assert.equal(JSON.parse(await fs.readFile(run.metadataPath, "utf8")).repository_root, repo);
  assert.equal(JSON.parse(await fs.readFile(run.statePath, "utf8")).status, "created");
  await assert.rejects(prepareRun({repo, config: cfg, id: () => "../unsafe"}), /safe identifier/);
  await assert.rejects(prepareRun({repo, config: cfg, id: () => "run-1"}), /exist/);
});

test("preflight resolves current, explicit, and remote HEAD bases and blocks unsafe repositories", async () => {
  const repo = await repository();
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const cfg = config(state);
  let run = await prepared(repo, cfg, "base-current");
  let adapter = createRuntimeAdapter({...run, config: cfg});
  assert.equal((await adapter.preflight()).base_branch, "main");

  const bare = path.join(state, "remote.git");
  await fs.mkdir(bare);
  await git(bare, "init", "--bare", "--initial-branch=main");
  await git(repo, "remote", "add", "origin", bare);
  await git(repo, "push", "-u", "origin", "main");
  await git(repo, "remote", "set-head", "origin", "main");
  run = await prepared(repo, cfg, "base-remote");
  adapter = createRuntimeAdapter({...run, config: cfg});
  const remote = await adapter.preflight();
  assert.equal(remote.has_remote, true);
  assert.equal(remote.base_branch, "main");

  const explicit = config(state, {git: {...cfg.git, base_branch: "main"}});
  run = await prepared(repo, explicit, "base-explicit");
  assert.equal((await createRuntimeAdapter({...run, config: explicit}).preflight()).base_branch, "main");
  await fs.writeFile(path.join(repo, "dirty.txt"), "dirty");
  run = await prepared(repo, cfg, "base-dirty");
  assert.equal((await createRuntimeAdapter({...run, config: cfg}).preflight()).status, "blocked");
});

test("preflight blocks probe failures, root mismatches, detached heads, and absent bases", async () => {
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const plain = await fs.mkdtemp(path.join(tmpdir(), "daddy-plain-"));
  let cfg = config(state);
  let run = await prepared(plain, cfg, "not-git");
  assert.match((await createRuntimeAdapter({...run, config: cfg}).preflight()).reason, /usable Git/);

  const repo = await repository();
  run = await prepared(repo, cfg, "root-mismatch");
  const rootFault = {current: {match: (program, args) => program === "git" && args.includes("--show-toplevel"), result: {exitCode: 0, stdout: `${plain}\n`, stderr: ""}}};
  assert.match((await createRuntimeAdapter({...run, config: cfg}, {execute: faultable(execute, rootFault)}).preflight()).reason, /root mismatch/);

  await git(repo, "checkout", "--detach");
  run = await prepared(repo, cfg, "detached");
  assert.match((await createRuntimeAdapter({...run, config: cfg}).preflight()).reason, /usable Git/);
  await git(repo, "checkout", "main");

  cfg = config(state, {git: {branch_prefix: "daddy/wip-", base_branch: "absent", remote: "origin"}});
  run = await prepared(repo, cfg, "base-absent");
  assert.match((await createRuntimeAdapter({...run, config: cfg}).preflight()).reason, /base branch does not exist/);
});

test("preflight accepts a remote-only explicit base and falls back when remote HEAD is absent", async () => {
  const repo = await repository();
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const bare = path.join(state, "remote.git");
  await fs.mkdir(bare);
  await git(bare, "init", "--bare", "--initial-branch=main");
  await git(repo, "remote", "add", "origin", bare);
  await git(repo, "push", "-u", "origin", "main");
  await git(repo, "branch", "remote-only");
  await git(repo, "push", "origin", "remote-only");
  await git(repo, "branch", "-D", "remote-only");
  const base = config(state);
  let run = await prepared(repo, base, "remote-head-fallback");
  assert.equal((await createRuntimeAdapter({...run, config: base}).preflight()).base_branch, "main");
  const explicit = config(state, {git: {...base.git, base_branch: "remote-only"}});
  run = await prepared(repo, explicit, "remote-only-base");
  assert.equal((await createRuntimeAdapter({...run, config: explicit}).preflight()).base_branch, "remote-only");
});

test("preflight persists exact base SHA and integration starts from it", async () => {
  const repo = await repository();
  const baseSha = await git(repo, "rev-parse", "main");
  await git(repo, "checkout", "-b", "topic");
  await fs.writeFile(path.join(repo, "topic.txt"), "topic\n");
  await git(repo, "add", "topic.txt");
  await git(repo, "commit", "-m", "topic");
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  cfg.git.base_branch = "main";
  const run = await prepared(repo, cfg, "base-sha");
  const adapter = createRuntimeAdapter({...run, config: cfg});
  const preflight = await adapter.preflight();
  assert.equal(preflight.base_sha, baseSha);
  assert.equal(JSON.parse(await fs.readFile(path.join(run.runDir, "preflight", "preflight.json"), "utf8")).base_sha, baseSha);
  const workspace = await adapter.createWorkspace({preflight});
  assert.equal(await git(workspace.path, "rev-parse", "HEAD"), baseSha);
  await adapter.cleanup();
});

test("harness uses direct OpenCode protocol, validates output, waits idle, and closes its pane", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "harness");
  const calls = [];
  const responses = [async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["feature request"]})];
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness(responses, calls)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  assert.equal((await adapter.runNode({node: "intent", input: {}, depth: 0})).outcome, "sdlc");
  assert.equal(calls.some((call) => call.args?.[3] === "opencode --auto --model test/intent-model"), true);
  assert.equal(calls.some((call) => call.args?.includes("Ask anything")), true);
  assert.equal(calls.some((call) => call.args?.includes("idle")), true);
  assert.equal(calls.filter((call) => call.args?.[1] === "close").length, 1);
  assert.equal(calls.every((call) => call.timeout === 5000), true);
  await adapter.cleanup();
});

test("malformed harness output times out after bounded retries and still closes panes", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "malformed");
  const calls = [];
  const unpublishedFs = {...fs, async access() { throw Object.assign(new Error("complete is absent"), {code: "ENOENT"}); }};
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness([async () => ({bad: true})], calls), fs: unpublishedFs});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  await assert.rejects(adapter.runNode({node: "intent", input: {}, depth: 0}), /malformed contract/);
  assert.equal(calls.filter((call) => call.args?.[1] === "close").length, 1);
  await adapter.cleanup();
});

test("complete plus an extra worker-style findings field fails immediately and retries infrastructure", async () => {
  const repo = await repository();
  const root = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const base = config(root);
  const cfg = {...base, runtime: {...base.runtime, node_retries: 1, node_timeout_seconds: 2, require_idle_status: false}};
  const run = await prepared(repo, cfg, "retry-node");
  const calls = [];
  const malformed = async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["retry"], discovery_findings: ["extra"]});
  const valid = async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["retry"]});
  const sleeps = [];
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness([malformed, valid], calls), sleep: sleeps.push.bind(sleeps, true)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  assert.equal((await adapter.runNode({node: "intent", input: {}, depth: 0})).outcome, "sdlc");
  assert.equal(calls.some((call) => call.args?.includes("agent-status")), false);
  assert.equal(calls.filter((call) => call.args?.[1] === "close").length, 2);
  assert.equal(calls.filter((call) => call.args?.[1] === "send-text" && !call.args[3].startsWith("opencode ")).length, 2);
  assert.equal(sleeps.length, 0);
  await adapter.record({type: "node-completed", node: "intent", depth: 0});
  await adapter.cleanup();
});

test("harness classifies every Herdr startup, send, and idle failure and scopes pane cleanup", async () => {
  const repo = await repository();
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  let sendTextCount = 0;
  const cases = [
    ["create", (program, args) => program === "herdr" && args[0] === "workspace", nonzero(), 0, /workspace create/],
    ["json", (program, args) => program === "herdr" && args[0] === "workspace", {exitCode: 0, stdout: "{", stderr: ""}, 0, /malformed workspace JSON/],
    ["pane", (program, args) => program === "herdr" && args[0] === "workspace", {exitCode: 0, stdout: JSON.stringify({result: {root_pane: {}}}), stderr: ""}, 0, /pane ID/],
    ["start-text", (program, args) => program === "herdr" && args[1] === "send-text", nonzero(), 1, /send-text/],
    ["start-enter", (program, args) => program === "herdr" && args[1] === "send-keys", nonzero(), 1, /send-keys/],
    ["startup", (program, args) => program === "herdr" && args[0] === "wait" && args[1] === "output", nonzero(), 1, /startup timed out/],
    ["prompt-text", (program, args) => {
      if (program !== "herdr" || args[1] !== "send-text") return false;
      sendTextCount += 1;
      return sendTextCount === 2;
    }, nonzero(), 1, /send-text/],
    ["idle", (program, args) => program === "herdr" && args.includes("agent-status"), nonzero(), 1, /idle wait/],
  ];
  for (const [name, match, result, closes, message] of cases) {
    sendTextCount = 0;
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, `herdr-${name}`);
    const calls = [];
    const response = async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["valid"]});
    const fault = {current: {match, result}};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([response], calls), fault)});
    const preflight = await adapter.preflight();
    await adapter.createWorkspace({preflight});
    await assert.rejects(adapter.runNode({node: "intent", input: {}, depth: 0}), message);
    assert.equal(calls.filter((call) => call.args?.[1] === "close").length, closes);
    await adapter.cleanup();
  }
});

test("strict node contracts reject every identity, shape, outcome, and path class", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "contracts");
  const validIntent = (nodeId) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["evidence"]});
  const validSpec = (nodeId) => ({...common(run.runId, nodeId), acceptance_criteria: ["accepted"], constraints: []});
  const validRca = (nodeId) => ({...common(run.runId, nodeId), root_cause: "cause", evidence: ["evidence"], reproduction: ["step"]});
  const invalidPlan = (nodeId, mutate) => {
    const value = plan(run.runId, nodeId);
    mutate(value);
    return value;
  };
  const cases = [
    ["intent", () => null, /must be an object/],
    ["intent", (nodeId) => ({...validIntent(nodeId), run_id: "wrong"}), /identity mismatch/],
    ["intent", (nodeId) => ({...validIntent(nodeId), status: "bad"}), /common contract/],
    ["intent", (nodeId) => ({...validIntent(nodeId), artifacts: "bad"}), /unique string array/],
    ["intent", (nodeId) => ({...validIntent(nodeId), artifacts: [""]}), /unique string array/],
    ["intent", (nodeId) => ({...validIntent(nodeId), artifacts: ["same", "same"]}), /unique string array/],
    ["intent", (nodeId) => ({...validIntent(nodeId), status: "blocked"}), /status and outcome/],
    ["intent", (nodeId) => ({...validIntent(nodeId), extra: true}), /unknown or missing/],
    ["intent", (nodeId) => ({...validIntent(nodeId), evidence: []}), /unique string array/],
    ["intent", (nodeId) => ({...validIntent(nodeId), outcome: "other"}), /intent output/],
    ["spec-design", (nodeId) => ({...validSpec(nodeId), acceptance_criteria: []}), /unique string array/],
    ["spec-design", (nodeId) => ({...validSpec(nodeId), constraints: [1]}), /unique string array/],
    ["spec-design", (nodeId) => ({...validSpec(nodeId), outcome: "other"}), /spec output/],
    ["plan", (nodeId) => ({...plan(run.runId, nodeId), outcome: "other"}), /plan output/],
    ["plan", (nodeId) => invalidPlan(nodeId, (value) => { value.items[0].title = ""; }), /title and objective/],
    ["plan", (nodeId) => invalidPlan(nodeId, (value) => { value.items[0].objective = ""; }), /title and objective/],
    ["plan", (nodeId) => invalidPlan(nodeId, (value) => { value.items[0].affected_paths = ["same", "same"]; }), /unique string array/],
    ["plan", (nodeId) => invalidPlan(nodeId, (value) => { value.items[0].extra = true; }), /unknown or missing fields/],
    ["issue-rca", (nodeId) => ({...validRca(nodeId), evidence: []}), /unique string array/],
    ["issue-rca", (nodeId) => ({...validRca(nodeId), reproduction: []}), /unique string array/],
    ["issue-rca", (nodeId) => ({...validRca(nodeId), root_cause: ""}), /RCA output/],
  ];
  const responses = cases.map(([, make]) => async ({nodeId}) => make(nodeId));
  const workerCases = [
    [(nodeId, work) => ({...common(run.runId, nodeId), item_id: `${work.id}-wrong`, changed_paths: []}), /worker output/],
    [(nodeId, work) => ({...common(run.runId, nodeId), item_id: work.id, changed_paths: ["/absolute"]}), /escapes worktree/],
    [(nodeId, work) => ({...common(run.runId, nodeId), item_id: work.id, changed_paths: ["a/../b"]}), /escapes worktree/],
    [(nodeId, work) => ({...common(run.runId, nodeId), item_id: work.id, changed_paths: []}), /requires changed paths/],
    [(nodeId, work) => ({...common(run.runId, nodeId), item_id: work.id, changed_paths: [], extra: true}), /unknown or missing/],
  ];
  responses.push(async ({nodeId}) => ({...common(run.runId, nodeId, "blocked"), evidence: ["blocked"]}));
  responses.push(...workerCases.map(([make], index) => async ({nodeId}) => make(nodeId, item(`contract-worker-${index}`))));
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness(responses)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  for (const [node, , message] of cases) await assert.rejects(adapter.runNode({node, input: {}, depth: node.startsWith("issue") ? 1 : 0}), message);
  assert.equal((await adapter.runNode({node: "intent", input: {}, depth: 0})).outcome, "blocked");
  for (let index = 0; index < workerCases.length; index += 1) {
    const work = item(`contract-worker-${index}`);
    await assert.rejects(adapter.runWorker({item: work, model: "low", depth: 0, attempt: 1}), workerCases[index][1]);
  }
  await adapter.cleanup();
});

test("worker paths are depth-qualified and affected_paths enforce NUL-safe exact and directory matches", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "worker-paths");
  const responses = [
    async ({nodeId, cwd}) => { await fs.mkdir(path.join(cwd, "dir with space")); await fs.writeFile(path.join(cwd, "dir with space", "file.txt"), "ok\n"); return {...common(run.runId, nodeId), item_id: "same", changed_paths: ["dir with space/file.txt"]}; },
    async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "escaped.txt"), "bad\n"); return {...common(run.runId, nodeId), item_id: "same", changed_paths: ["escaped.txt"]}; },
  ];
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness(responses)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  const firstItem = {...item("same"), affected_paths: ["dir with space/"], validation_commands: ["test -f 'dir with space/file.txt'"]};
  const secondItem = {...item("same"), affected_paths: ["declared.txt"], validation_commands: ["true"]};
  const first = await adapter.runWorker({item: firstItem, model: "test/low", depth: 1, attempt: 1, request: "r", context: {history: []}});
  const second = await adapter.runWorker({item: secondItem, model: "test/low", depth: 2, attempt: 1, request: "r", context: {history: []}});
  assert.notEqual(first.worktree, second.worktree);
  assert.equal((await adapter.integrate({item: firstItem, worker: first, depth: 1})).outcome, "success");
  const mismatch = await adapter.integrate({item: secondItem, worker: second, depth: 2});
  assert.equal(mismatch.outcome, "failure");
  assert.match(mismatch.reason, /outside affected_paths/);
  await adapter.cleanup();
});

test("porcelain v1 NUL parsing handles staged renames with spaces", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "rename-space");
  const work = {...item("rename"), affected_paths: ["renamed file.md"], validation_commands: ["test -f 'renamed file.md'"]};
  const response = async ({nodeId, cwd}) => {
    await execute("git", ["mv", "README.md", "renamed file.md"], {cwd});
    return {...common(run.runId, nodeId), item_id: work.id, changed_paths: ["renamed file.md"]};
  };
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness([response])});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  const worker = await adapter.runWorker({item: work, model: "test/low", depth: 0, attempt: 1, request: "r", context: {history: []}});
  assert.equal((await adapter.integrate({item: work, worker, depth: 0})).outcome, "success");
  await adapter.cleanup();
});

test("serial integration reports engineering conflict and aborts cherry-pick", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "conflict");
  const first = {...item("first"), affected_paths: ["README.md"], validation_commands: ["test -f README.md"]};
  const second = {...item("second"), affected_paths: ["README.md"], validation_commands: ["test -f README.md"]};
  const responses = [
    async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "README.md"), "first\n"); return {...common(run.runId, nodeId), item_id: "first", changed_paths: ["README.md"]}; },
    async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "README.md"), "second\n"); return {...common(run.runId, nodeId), item_id: "second", changed_paths: ["README.md"]}; },
  ];
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness(responses)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  const worker1 = await adapter.runWorker({item: first, model: "low", depth: 0, attempt: 1});
  const worker2 = await adapter.runWorker({item: second, model: "low", depth: 0, attempt: 1});
  assert.equal((await adapter.integrate({item: first, worker: worker1, depth: 0})).outcome, "success");
  const conflict = await adapter.integrate({item: second, worker: worker2, depth: 0});
  assert.equal(conflict.outcome, "failure");
  assert.match(conflict.reason, /conflict/);
  await adapter.cleanup();
});

test("workspace and worker creation classify Git infrastructure failures", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  let run = await prepared(repo, cfg, "workspace-fail");
  let fault = {current: null};
  let adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([]), fault)});
  let preflight = await adapter.preflight();
  fault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "add", result: nonzero()};
  await assert.rejects(adapter.createWorkspace({preflight}), /integration worktree creation/);

  run = await prepared(repo, cfg, "worker-create-fail");
  fault = {current: null};
  adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([]), fault)});
  preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  fault.current = {match: (program, args, options) => program === "git" && args[0] === "rev-parse" && options.cwd.includes("integration"), result: nonzero()};
  await assert.rejects(adapter.runWorker({item: item("head-fail"), model: "low", depth: 0, attempt: 1}), /integration HEAD/);
  fault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "add", result: nonzero()};
  await assert.rejects(adapter.runWorker({item: item("worktree-fail"), model: "low", depth: 0, attempt: 1}), /worker worktree creation/);
  await adapter.cleanup();
});

test("integration classifies every validation, commit, identity, and cleanup failure", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "integration-failures");
  const specs = [
    ["status", true, ["made.txt"], ["true"]],
    ["mismatch", true, ["reported.txt"], ["true"]],
    ["validation", true, ["made.txt"], ["false"]],
    ["validation-126", true, ["made.txt"], ["./README.md"]],
    ["validation-127", true, ["made.txt"], ["daddy-validation-command-that-does-not-exist"]],
    ["empty", false, [], ["true"]],
    ["add", true, ["made.txt"], ["true"]],
    ["commit", true, ["made.txt"], ["true"]],
    ["sha", true, ["made.txt"], ["true"]],
    ["remove", true, ["made.txt"], ["true"]],
    ["branch", true, ["made.txt"], ["true"]],
  ];
  const responses = specs.map(([name, modify, changed]) => async ({nodeId, cwd}) => {
    if (modify) await fs.writeFile(path.join(cwd, "made.txt"), `${name}\n`);
    return {...common(run.runId, nodeId, name === "empty" ? "blocked" : "success"), item_id: `integrate-${name}`, changed_paths: changed};
  });
  const fault = {current: null};
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness(responses), fault)});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  assert.equal((await adapter.integrate({item: item("missing"), worker: {changed_paths: []}, depth: 0})).outcome, "blocked");
  const expected = ["blocked", "failure", "failure", "blocked", "blocked", "failure", "failure", "failure", "blocked", "blocked", "blocked"];
  for (let index = 0; index < specs.length; index += 1) {
    const [name, , , validations] = specs[index];
    const work = {...item(`integrate-${name}`), validation_commands: validations};
    const worker = await adapter.runWorker({item: work, model: "low", depth: 0, attempt: 1});
    if (name === "status") fault.current = {match: (program, args) => program === "git" && args[0] === "status", result: nonzero()};
    if (name === "add") fault.current = {match: (program, args) => program === "git" && args[0] === "add", result: nonzero()};
    if (name === "commit") fault.current = {match: (program, args) => program === "git" && args[0] === "commit", result: nonzero()};
    if (name === "sha") fault.current = {match: (program, args) => program === "git" && args[0] === "rev-parse", result: nonzero()};
    if (name === "remove") fault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "remove", result: nonzero()};
    if (name === "branch") fault.current = {match: (program, args) => program === "git" && args[0] === "branch" && args[1] === "-D", result: nonzero()};
    assert.equal((await adapter.integrate({item: work, worker, depth: 0})).outcome, expected[index], name);
  }
  await adapter.cleanup();
});

test("verification records a clean HEAD and ship rejects post-verification mutation", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "verify-fail");
  const adapter = createRuntimeAdapter({...run, config: cfg});
  const preflight = await adapter.preflight();
  const workspace = await adapter.createWorkspace({preflight});
  const failed = await adapter.verify({plan: {final_validation_commands: ["true", "false"]}, depth: 1});
  assert.equal(failed.outcome, "failure");
  assert.deepEqual(failed.results.map((result) => result.exit_code), [0, 1]);
  for (const [command, exitCode] of [["./README.md", 126], ["daddy-validation-command-that-does-not-exist", 127]]) {
    const blocked = await adapter.verify({plan: {final_validation_commands: [command, "true"]}, depth: 1});
    assert.equal(blocked.outcome, "blocked");
    assert.deepEqual(blocked.results.map((result) => result.exit_code), [exitCode]);
  }
  const verification = await adapter.verify({plan: {final_validation_commands: ["true"]}, depth: 1});
  assert.match(verification.verified_commit, /^[0-9a-f]{40}$/);
  await fs.writeFile(path.join(workspace.path, "final.txt"), "final\n");
  const delivery = await adapter.ship({verification});
  assert.equal(delivery.status, "halted");
  assert.match(delivery.reason, /mutated after verification/);
});

test("verification blocks dirty trees, mutating commands, and unavailable HEADs", async () => {
  const repo = await repository();
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  for (const name of ["dirty", "mutating", "head"]) {
    const cfg = config(state);
    const run = await prepared(repo, cfg, `verify-${name}`);
    const fault = {current: null};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([]), fault)});
    const preflight = await adapter.preflight();
    const workspace = await adapter.createWorkspace({preflight});
    let commands = ["true"];
    if (name === "dirty") await fs.writeFile(path.join(workspace.path, "dirty.txt"), "dirty\n");
    if (name === "mutating") commands = ["touch changed.txt"];
    if (name === "head") fault.current = {match: (program, args, options) => program === "git" && args[0] === "rev-parse" && options.cwd === workspace.path, result: nonzero()};
    const result = await adapter.verify({plan: {final_validation_commands: commands}, depth: 0});
    assert.equal(result.outcome, "blocked", name);
    await adapter.halt({reason: name});
  }
});

test("explicit incompatible PR mode and unsupported ship mode halt deterministically", async () => {
  for (const mode of ["pull-request", "mystery"]) {
    const repo = await repository();
    const base = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
    const cfg = {...base, delivery: {...base.delivery, mode}};
    const run = await prepared(repo, cfg, `mode-${mode}`);
    const adapter = createRuntimeAdapter({...run, config: cfg});
    const preflight = await adapter.preflight();
    if (mode === "pull-request") {
      assert.equal(preflight.status, "blocked");
    } else {
      await adapter.createWorkspace({preflight});
      const verification = await adapter.verify({plan: {final_validation_commands: ["true"]}, depth: 0});
      assert.equal((await adapter.ship({verification})).status, "halted");
    }
    await adapter.cleanup();
  }
});

test("local shipping covers status, SHA, mode, defaults, mutation, identity, and cleanup paths", async () => {
  const repo = await repository();
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const cases = ["unverified", "status", "sha", "incompatible", "none", "defaults", "cleanup", "mutation", "identity"];
  for (const name of cases) {
    const cfg = config(stateRoot);
    if (name === "none") cfg.delivery.mode = "none";
    if (name === "defaults") delete cfg.delivery;
    const run = await prepared(repo, cfg, `ship-${name}`);
    const calls = [];
    const fault = {current: null};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([], calls), fault)});
    const preflight = await adapter.preflight();
    const workspace = await adapter.createWorkspace({preflight});
    const verification = await adapter.verify({plan: {final_validation_commands: ["true"]}, depth: 0});
    if (name === "mutation") await fs.writeFile(path.join(workspace.path, "mutation.txt"), "mutation\n");
    if (name === "status") fault.current = {match: (program, args) => program === "git" && args[0] === "status", result: nonzero()};
    if (name === "sha") fault.current = {match: (program, args) => program === "git" && args[0] === "rev-parse", result: nonzero()};
    if (name === "incompatible") cfg.delivery.mode = "pull-request";
    if (name === "cleanup") fault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "remove", result: nonzero()};
    if (name === "identity") verification.verified_commit = "0".repeat(40);
    const result = await adapter.ship(name === "unverified" ? undefined : {verification});
    if (["unverified", "status", "sha", "incompatible", "cleanup", "mutation", "identity"].includes(name)) {
      assert.equal(result.status, "halted", name);
    } else {
      assert.equal(result.status, "delivered", name);
      assert.equal(result.mode, name === "none" ? "none" : "local-branch");
      assert.equal(result.worktrees_removed, true);
    }
    await adapter.cleanup();
  }
});

test("remote shipping covers adaptive defaults, draft PRs, push failures, and gh failures", async () => {
  const repo = await repository();
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const bare = path.join(stateRoot, "remote.git");
  await fs.mkdir(bare);
  await git(bare, "init", "--bare", "--initial-branch=main");
  await git(repo, "remote", "add", "origin", bare);
  await git(repo, "push", "-u", "origin", "main");
  for (const name of ["default", "draft", "push", "gh"]) {
    const cfg = config(stateRoot, {git: {branch_prefix: "daddy/wip-", base_branch: "main", remote: "origin"}});
    if (name === "default") cfg.delivery = {mode: "adaptive"};
    if (name === "draft") cfg.delivery = {...cfg.delivery, mode: "pull-request", draft_pull_request: true};
    const run = await prepared(repo, cfg, `remote-${name}`);
    const calls = [];
    const fault = {current: null};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([], calls), fault)});
    const preflight = await adapter.preflight();
    await adapter.createWorkspace({preflight});
    const verification = await adapter.verify({plan: {final_validation_commands: ["true"]}, depth: 0});
    if (name === "push") fault.current = {match: (program, args) => program === "git" && args[0] === "push", result: nonzero()};
    if (name === "gh") fault.current = {match: (program) => program === "gh", result: nonzero()};
    const result = await adapter.ship({verification});
    assert.equal(result.status, ["push", "gh"].includes(name) ? "halted" : "delivered", name);
    if (name === "draft") assert.equal(calls.some((call) => call.program === "gh" && call.args.includes("--draft")), true);
    assert.equal(calls.every((call) => call.timeout === 5000), true);
    await adapter.cleanup();
  }
});

test("complete SDLC integrates worker changes, verifies, and adaptively ships a local branch", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "sdlc-local");
  const work = item();
  const responses = [
    async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["feature"]}),
    async ({nodeId}) => ({...common(run.runId, nodeId), acceptance_criteria: ["file"], constraints: []}),
    async ({nodeId}) => plan(run.runId, nodeId, work),
    async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "made\n"); return {...common(run.runId, nodeId), item_id: work.id, changed_paths: ["made.txt"]}; },
  ];
  const result = await runPreparedRun({...run, config: cfg}, {execute: fakeHarness(responses)});
  assert.equal(result.status, "delivered");
  assert.equal(result.mode, "local-branch");
  assert.equal(result.worktrees_removed, true);
  assert.match(await git(repo, "show", `${result.branch}:made.txt`), /made/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(run.runDir, "request", "request.json"), "utf8")), {schema_version: 1, run_id: run.runId, request: "Build the requested file safely.\n", invocation_directory: path.resolve(".")});
  assert.equal(JSON.parse(await fs.readFile(path.join(run.runDir, "delivery", "pending.json"), "utf8")).verified_commit, result.commit);
  assert.equal(result.verified_commit, result.commit);
  const events = (await fs.readFile(run.eventsPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(events.some((event) => event.type === "worker-started" && event.item_id === "change"), true);
  assert.equal(events.some((event) => event.type === "shipping" && event.state_status === "shipping"), true);
  assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
});

test("runDag halts item and final validation exit 127 as infrastructure without creating an issue", async () => {
  for (const stage of ["item", "final"]) {
    const repo = await repository();
    const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
    const run = await prepared(repo, cfg, `validation-127-${stage}`);
    const work = {...item(), validation_commands: [stage === "item" ? "daddy-validation-command-that-does-not-exist" : "true"]};
    const generatedPlan = {...plan(run.runId, "sdlc.plan", work), final_validation_commands: [stage === "final" ? "daddy-validation-command-that-does-not-exist" : "true"]};
    const responses = [
      async ({nodeId}) => ({...common(run.runId, nodeId, "sdlc"), evidence: ["feature"]}),
      async ({nodeId}) => ({...common(run.runId, nodeId), acceptance_criteria: ["file"], constraints: []}),
      async ({nodeId}) => ({...generatedPlan, node_id: nodeId}),
      async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "made\n"); return {...common(run.runId, nodeId), item_id: work.id, changed_paths: ["made.txt"]}; },
    ];
    const result = await runPreparedRun({...run, config: cfg}, {execute: fakeHarness(responses)});
    assert.equal(result.status, "halted");
    assert.match(result.reason, /infrastructure|blocked/);
    const events = await fs.readFile(run.eventsPath, "utf8");
    assert.doesNotMatch(events, /issue-created|issue-rca/);
    if (stage === "item") {
      const evidence = JSON.parse(await fs.readFile(path.join(run.runDir, "nodes", "sdlc.build.change", "1", "item-validation.json"), "utf8"));
      assert.equal(evidence.outcome, "blocked");
      assert.equal(evidence.validation.exit_code, 127);
    } else {
      const evidence = JSON.parse(await fs.readFile(path.join(run.runDir, "nodes", "sdlc.verify", "1", "output.json"), "utf8"));
      assert.equal(evidence.outcome, "blocked");
      assert.equal(evidence.results[0].exit_code, 127);
    }
  }
});

test("complete issue route and pull-request shipping use fake external boundaries", async () => {
  const repo = await repository();
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const bare = path.join(state, "remote.git");
  await fs.mkdir(bare);
  await git(bare, "init", "--bare", "--initial-branch=main");
  await git(repo, "remote", "add", "origin", bare);
  await git(repo, "push", "-u", "origin", "main");
  const cfg = config(state, {git: {branch_prefix: "daddy/wip-", base_branch: "main", remote: "origin"}});
  const run = await prepared(repo, cfg, "issue-pr");
  const work = item("repair");
  const calls = [];
  const responses = [
    async ({nodeId}) => ({...common(run.runId, nodeId, "issue"), evidence: ["bug"]}),
    async ({nodeId}) => ({...common(run.runId, nodeId), root_cause: "missing file", evidence: ["absent"], reproduction: ["test -f made.txt"]}),
    async ({nodeId}) => plan(run.runId, nodeId, work),
    async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "fixed\n"); return {...common(run.runId, nodeId), item_id: work.id, changed_paths: ["made.txt"]}; },
  ];
  const result = await runPreparedRun({...run, config: cfg}, {execute: fakeHarness(responses, calls)});
  assert.equal(result.mode, "pull-request");
  assert.equal(result.pull_request_url, "https://example.test/pr/1");
  assert.equal(calls.some((call) => call.program === "gh" && call.args[0] === "pr"), true);
});

test("halt checkpoint commits recoverable integration WIP", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "checkpoint");
  const adapter = createRuntimeAdapter({...run, config: cfg});
  const preflight = await adapter.preflight();
  const workspace = await adapter.createWorkspace({preflight});
  await fs.writeFile(path.join(workspace.path, "recover.txt"), "recoverable\n");
  const halted = await adapter.halt({reason: "test halt", node: "build", depth: 1});
  assert.equal(halted.status, "halted");
  assert.match(halted.checkpoint_commit, /^[0-9a-f]{40}$/);
  assert.match(await git(repo, "show", `${halted.checkpoint_branch}:recover.txt`), /recoverable/);
  assert.equal((await fs.readFile(path.join(run.runDir, "halted", "pending.json"), "utf8")).includes("test halt"), true);
});

test("halt checkpoints dirty worker branches before removing depth-qualified worktrees", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "worker-checkpoint");
  const work = item("repeat");
  const response = async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "recover worker\n"); return {...common(run.runId, nodeId), item_id: work.id, changed_paths: ["made.txt"]}; };
  const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: fakeHarness([response])});
  const preflight = await adapter.preflight();
  await adapter.createWorkspace({preflight});
  await adapter.runWorker({item: work, model: "test/low", depth: 2, attempt: 1, request: "r", context: {history: []}});
  const halted = await adapter.halt({reason: "worker recovery", node: "issue-build", depth: 2});
  assert.equal(halted.worker_checkpoints.length, 1);
  assert.match(halted.worker_checkpoints[0].branch, /issue-2-repeat$/);
  assert.match(await git(repo, "show", `${halted.worker_checkpoints[0].branch}:made.txt`), /recover worker/);

  const failedRun = await prepared(repo, cfg, "worker-checkpoint-failed");
  const fault = {current: null};
  const failedResponse = async ({nodeId, cwd}) => { await fs.writeFile(path.join(cwd, "made.txt"), "recover worker\n"); return {...common(failedRun.runId, nodeId), item_id: work.id, changed_paths: ["made.txt"]}; };
  const failedAdapter = createRuntimeAdapter({...failedRun, config: cfg}, {execute: faultable(fakeHarness([failedResponse]), fault)});
  const failedPreflight = await failedAdapter.preflight();
  await failedAdapter.createWorkspace({preflight: failedPreflight});
  const dirtyWorker = await failedAdapter.runWorker({item: work, model: "test/low", depth: 2, attempt: 1, request: "r", context: {history: []}});
  fault.current = {match: (program, args, options) => program === "git" && args[0] === "commit" && options.cwd === dirtyWorker.worktree, result: nonzero()};
  const preserved = await failedAdapter.halt({reason: "checkpoint failed", node: "issue-build", depth: 2});
  assert.deepEqual(preserved.worker_checkpoints, []);
  assert.equal(preserved.worktrees_removed, false);
  await fs.access(path.join(dirtyWorker.worktree, "made.txt"));
});

test("halt covers absent, clean, failed checkpoint, empty SHA, and cleanup paths", async () => {
  const repo = await repository();
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  for (const name of ["absent", "clean", "clean-sha", "status", "add", "commit", "sha", "cleanup"]) {
    const cfg = config(stateRoot);
    const run = await prepared(repo, cfg, `halt-${name}`);
    const fault = {current: null};
    const adapter = createRuntimeAdapter({...run, config: cfg}, {execute: faultable(fakeHarness([]), fault)});
    if (name !== "absent") {
      const preflight = await adapter.preflight();
      const workspace = await adapter.createWorkspace({preflight});
      if (["add", "commit", "sha"].includes(name)) await fs.writeFile(path.join(workspace.path, `${name}.txt`), `${name}\n`);
    }
    if (name === "status") fault.current = {match: (program, args) => program === "git" && args[0] === "status", result: nonzero()};
    if (name === "add") fault.current = {match: (program, args) => program === "git" && args[0] === "add", result: nonzero()};
    if (name === "commit") fault.current = {match: (program, args) => program === "git" && args[0] === "commit", result: nonzero()};
    if (name === "sha") fault.current = {match: (program, args) => program === "git" && args[0] === "rev-parse", result: nonzero()};
    if (name === "clean-sha") fault.current = {match: (program, args) => program === "git" && args[0] === "rev-parse", result: nonzero()};
    if (name === "cleanup") fault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "remove", result: nonzero()};
    const result = await adapter.halt({reason: name});
    assert.equal(result.status, "halted");
    assert.equal(result.checkpoint_branch, name === "absent" ? null : `daddy/wip-halt-${name}`);
    assert.deepEqual(result.worker_checkpoints, []);
    if (["absent", "clean-sha", "status", "add", "commit", "sha"].includes(name)) assert.equal(result.checkpoint_commit, null);
    if (name === "clean") assert.match(result.checkpoint_commit, /^[0-9a-f]{40}$/);
    if (["status", "add", "commit", "sha", "clean-sha", "cleanup"].includes(name)) assert.equal(result.worktrees_removed, false);
    await adapter.cleanup();
  }
});

test("record writes are serialized, preserve details, and surface asynchronous failures", async () => {
  const repo = await repository();
  const cfg = config(await fs.mkdtemp(path.join(tmpdir(), "daddy-state-")));
  const run = await prepared(repo, cfg, "record-failure");
  let failed = false;
  const failingFs = {...fs, async rename(source, target) {
    if (!failed && target.endsWith("events.jsonl")) {
      failed = true;
      throw new Error("event write failed");
    }
    return await fs.rename(source, target);
  }};
  const adapter = createRuntimeAdapter({...run, config: cfg}, {fs: failingFs});
  await assert.rejects(adapter.record({type: "custom", depth: 2, node: "node", detail: "kept"}), /event write failed/);
  await assert.rejects(adapter.flushRecords(), /event write failed/);
});

test("default configuration, clock, ID, repository, metadata, sleep, and result normalization paths", async () => {
  const repo = await repository();
  const stateRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-state-"));
  const cfg = config(stateRoot);
  const generated = await prepareRun({repo, config: cfg});
  assert.match(generated.runId, /^\d{14}-[0-9a-f-]{36}$/);
  const fromCwd = await prepareRun({config: cfg, id: () => "default-repo"});
  assert.equal(fromCwd.repositoryRoot, path.resolve("."));
  const defaultConfigRun = await prepareRun({repo, id: () => `default-config-${process.pid}`});
  assert.equal(defaultConfigRun.repositoryRoot, repo);
  await fs.rm(defaultConfigRun.runDir, {recursive: true, force: true});
  const defaultRootConfig = {...cfg, paths: {worktree_root: cfg.paths.worktree_root}};
  const defaultRootRun = await prepareRun({repo, config: defaultRootConfig, id: () => `default-root-${process.pid}`});
  await fs.rm(defaultRootRun.runDir, {recursive: true, force: true});

  const yamlRoot = await fs.mkdtemp(path.join(tmpdir(), "daddy-config-"));
  const yamlPath = path.join(yamlRoot, "without-paths.yaml");
  const withoutPaths = config(stateRoot);
  delete withoutPaths.paths;
  await fs.writeFile(yamlPath, YAML.stringify(withoutPaths));
  assert.equal((await loadConfig(yamlPath)).paths, undefined);
  assert.equal((await loadConfig()).version, 1);

  const metadataContext = {metadata: {run_id: generated.runId, run_dir: generated.runDir, repository_root: repo}, config: cfg};
  const normalized = async (program, args, options) => {
    const result = await execute(program, args, options);
    return {exit_code: result.exitCode, stdout: result.stdout};
  };
  const metadataAdapter = createRuntimeAdapter(metadataContext, {execute: normalized});
  assert.equal((await metadataAdapter.preflight()).status, "ready");

  const defaultPolicy = {...cfg, paths: {run_root: cfg.paths.run_root}};
  delete defaultPolicy.git;
  const defaultPolicyRun = await prepared(repo, defaultPolicy, "default-policy");
  const resultFault = {current: null};
  const defaultPolicyAdapter = createRuntimeAdapter({...defaultPolicyRun, config: defaultPolicy}, {execute: faultable(fakeHarness([]), resultFault)});
  const defaultPolicyPreflight = await defaultPolicyAdapter.preflight();
  const defaultWorkspace = await defaultPolicyAdapter.createWorkspace({preflight: defaultPolicyPreflight});
  resultFault.current = {match: (program, args) => program === "git" && args[0] === "worktree" && args[1] === "remove", result: {}};
  await defaultPolicyAdapter.cleanup();
  await fs.rm(path.dirname(defaultWorkspace.path), {recursive: true, force: true});

  const delayedRun = await prepared(repo, {...cfg, runtime: {...cfg.runtime, node_timeout_seconds: 0.02, poll_interval_seconds: 0.01}}, "default-sleep");
  const delayed = async ({nodeId}) => ({...common(delayedRun.runId, nodeId, "sdlc"), evidence: ["late"]});
  let accessCalls = 0;
  const delayedFs = {...fs, async access(target) {
    if (!target.endsWith("complete")) return await fs.access(target);
    accessCalls += 1;
    if (accessCalls === 1) throw Object.assign(new Error("not published"), {code: "ENOENT"});
    return await fs.access(target);
  }};
  const delayedAdapter = createRuntimeAdapter({...delayedRun, config: {...cfg, runtime: {...cfg.runtime, node_timeout_seconds: 0.02, poll_interval_seconds: 0.01}}}, {execute: fakeHarness([delayed]), fs: delayedFs});
  const preflight = await delayedAdapter.preflight();
  await delayedAdapter.createWorkspace({preflight});
  assert.equal((await delayedAdapter.runNode({node: "intent", input: {}, depth: 0})).outcome, "sdlc");
  assert.equal(accessCalls, 2);
  await delayedAdapter.cleanup();
});

test("planning and worker prompts prohibit discovery items, prose validation, and no-change success", async () => {
  const [planPrompt, issuePlanPrompt, workerPrompt] = await Promise.all([
    fs.readFile(path.resolve("prompts/plan.md"), "utf8"),
    fs.readFile(path.resolve("prompts/issue-plan.md"), "utf8"),
    fs.readFile(path.resolve("prompts/worker.md"), "utf8"),
  ]);
  for (const prompt of [planPrompt, issuePlanPrompt]) {
    assert.match(prompt, /Inspect the current repository yourself/);
    assert.match(prompt, /Never create discovery-only, inspection-only, validation-only, or manual-only items/);
    assert.match(prompt, /concrete repository-relative file or directory/);
    assert.match(prompt, /literal non-interactive executable shell command/);
    assert.match(prompt, /Never emit prose or imperatives/);
  }
  assert.match(workerPrompt, /requires at least one actual Git changed path matching `affected_paths`/);
  assert.match(workerPrompt, /if no repository changes are necessary, return `blocked`/);
  assert.match(workerPrompt, /exactly these fields and no others/);
  assert.match(workerPrompt, /`discovery_findings`/);
});
