import test from "node:test";
import assert from "node:assert/strict";
import {promises as fs} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import YAML from "yaml";
import {main} from "../src/cli.mjs";
import {execute} from "../src/runtime.mjs";

const sink = () => ({value: "", write(chunk) { this.value += chunk; }});

test("CLI reports useful argument and empty-request errors", async () => {
  const stdout = sink();
  const stderr = sink();
  assert.equal(await main([], {stdout, stderr}), 1);
  assert.match(stderr.value, /usage/);
  stderr.value = "";
  assert.equal(await main(["prepare"], {stdout, stderr}), 1);
  assert.match(stderr.value, /--repo is required/);
});

test("CLI prepare emits one-line JSON with controlled paths", async () => {
  const repo = await fs.mkdtemp(path.join(tmpdir(), "daddy-cli-repo-"));
  let result = await execute("git", ["init", "-b", "main"], {cwd: repo});
  assert.equal(result.exitCode, 0);
  const state = await fs.mkdtemp(path.join(tmpdir(), "daddy-cli-state-"));
  const configPath = path.join(state, "config.yaml");
  const config = YAML.parse(await fs.readFile(path.resolve("daddy-config.yaml"), "utf8"));
  config.paths = {run_root: `${state}/runs`, worktree_root: `${state}/worktrees`};
  config.runtime.command_timeout_seconds = 5;
  config.build = {...config.build, max_concurrency: 1, max_items: 2};
  await fs.writeFile(configPath, YAML.stringify(config));
  const stdout = sink();
  const stderr = sink();
  const code = await main(["prepare", "--repo", repo], {stdout, stderr, configPath, id: () => "cli-run", clock: {now: () => new Date("2026-07-26T00:00:00Z")}});
  assert.equal(code, 0, stderr.value);
  assert.equal(stdout.value.trim().split("\n").length, 1);
  const prepared = JSON.parse(stdout.value);
  assert.equal(prepared.requestPath, path.join(prepared.runDir, "request", "request.txt"));

  stdout.value = "";
  assert.equal(await main(["run", "--run-dir", prepared.runDir], {stdout, stderr}), 1);
  assert.match(stderr.value, /request file must be non-empty/);
  await assert.rejects(fs.access(path.join(prepared.runDir, "run.lock")));

  await fs.writeFile(prepared.requestPath, "request\n");
  await fs.writeFile(path.join(prepared.runDir, "run.lock"), "held\n");
  stderr.value = "";
  assert.equal(await main(["run", "--run-dir", prepared.runDir], {stdout, stderr}), 1);
  assert.match(stderr.value, /already locked/);
  await fs.unlink(path.join(prepared.runDir, "run.lock"));
  stdout.value = "";
  stderr.value = "";
  assert.equal(await main(["run", "--run-dir", prepared.runDir], {stdout, stderr}), 0, stderr.value);
  assert.equal(JSON.parse(stdout.value).status, "halted");
  stdout.value = "";
  stderr.value = "";
  assert.equal(await main(["run", "--run-dir", prepared.runDir], {stdout, stderr}), 1);
  assert.match(stderr.value, /cannot start from status halted/);
  await assert.rejects(fs.access(path.join(prepared.runDir, "run.lock")));
});

test("CLI module auto-runs only when directly invoked", async () => {
  const result = await execute(process.execPath, [path.resolve("src/cli.mjs")], {cwd: path.resolve(".")});
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /usage/);
});
