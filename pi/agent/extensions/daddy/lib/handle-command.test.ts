// lib/handle-command.test.ts
import { test, expect } from "bun:test";
import { handleCommand } from "./handle-command.ts";
import type { RunDeps } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-hc-b-"));
fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
fs.writeFileSync(path.join(bundled, "workflows", "demo.yaml"), "name: demo\ndescription: a demo\nnodes:\n  - id: a\n    bash: echo hi\n");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-hc-h-"));
const deps: RunDeps = {
  exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunDeps["exec"],
  notify: () => {}, emit: () => {}, home, bundledDir: bundled, projectDir: process.cwd(),
};

test("list reports bundled workflows", async () => {
  let out = "";
  await handleCommand({ kind: "list" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain("demo: a demo");
});

test("validate reports validity", async () => {
  let out = "";
  await handleCommand({ kind: "validate", name: "demo" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain("valid");
});

test("run executes and reports summary", async () => {
  let out = "";
  await handleCommand({ kind: "run", flow: "demo", args: "" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain('Workflow "demo"');
});

test("unknown reports help", async () => {
  let out = "";
  await handleCommand({ kind: "unknown", raw: "x" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain("Unknown subcommand");
});

test("status reports no runs when home is empty", async () => {
  const freshHome = fs.mkdtempSync(path.join(os.tmpdir(), "ht-hc-status-"));
  const freshDeps = { ...deps, home: freshHome };
  let out = "";
  await handleCommand({ kind: "status" }, freshDeps, (t) => { out = t; }, () => {});
  expect(out).toBe("No runs.");
});

test("list reports no workflows when dir is empty", async () => {
  const emptyBundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-hc-e-"));
  const emptyDeps = { ...deps, bundledDir: emptyBundled };
  let out = "";
  await handleCommand({ kind: "list" }, emptyDeps, (t) => { out = t; }, () => {});
  expect(out).toBe("No workflows.");
});

test("merge reports success", async () => {
  let out = "";
  await handleCommand({ kind: "merge" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain("merged");
});

test("keep reports kept", async () => {
  let out = "";
  await handleCommand({ kind: "keep" }, deps, (t) => { out = t; }, () => {});
  expect(out).toBe("Worktree kept.");
});

test("approve with no paused run reports so", async () => {
  let out = "";
  await handleCommand({ kind: "approve", comment: "x" }, deps, (t) => { out = t; }, () => {});
  expect(out).toContain("No paused run");
});
