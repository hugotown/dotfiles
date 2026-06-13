// lib/dag-executor.test.ts
import { test, expect } from "bun:test";
import { executeDag } from "./dag-executor.ts";
import type { WorkflowDef } from "../types.ts";
import type { RunState, RunDeps } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-dag-"));
const deps: RunDeps = {
  exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunDeps["exec"],
  notify: () => {}, emit: () => {}, home, bundledDir: "/b", projectDir: process.cwd(),
};
const seed = (def: WorkflowDef): RunState => ({
  id: "r", workflow: "w", arguments: "", status: "running", artifacts_dir: "/a",
  base_branch: "main", started_at: "t",
  nodes: Object.fromEntries(def.nodes.map((n) => [n.id, { status: "pending", output: "" }])),
});

test("runs a linear bash DAG to completion and passes outputs", async () => {
  const def: WorkflowDef = { name: "w", description: "d", nodes: [
    { id: "a", bash: "echo hello" },
    { id: "b", bash: "echo got $a.output", depends_on: ["a"] },
  ] };
  const s = await executeDag(def, seed(def), deps);
  expect(s.status).toBe("completed");
  expect(s.nodes.b.output).toBe("got hello");
});

test("skips a node whose when is false", async () => {
  const def: WorkflowDef = { name: "w", description: "d", nodes: [
    { id: "a", bash: "echo bug" },
    { id: "b", bash: "echo run", depends_on: ["a"], when: "$a.output == 'feature'" },
  ] };
  const s = await executeDag(def, seed(def), deps);
  expect(s.nodes.b.status).toBe("skipped");
});

test("pauses at an approval node and halts later layers", async () => {
  const def: WorkflowDef = { name: "w", description: "d", nodes: [
    { id: "gate", approval: { message: "ok?" } },
    { id: "after", bash: "echo after", depends_on: ["gate"] },
  ] };
  const s = await executeDag(def, seed(def), deps);
  expect(s.status).toBe("paused");
  expect(s.paused_node).toBe("gate");
  expect(s.nodes.after.status).toBe("pending");
});

test("cancel node cancels the run", async () => {
  const def: WorkflowDef = { name: "w", description: "d", nodes: [{ id: "c", cancel: "stop" }] };
  const s = await executeDag(def, seed(def), deps);
  expect(s.status).toBe("cancelled");
});

test("resume skips completed nodes", async () => {
  const def: WorkflowDef = { name: "w", description: "d", nodes: [
    { id: "a", bash: "echo A" }, { id: "b", bash: "echo B", depends_on: ["a"] },
  ] };
  const state = seed(def);
  state.nodes.a = { status: "completed", output: "cached" };
  const s = await executeDag(def, state, deps);
  expect(s.nodes.a.output).toBe("cached");
  expect(s.nodes.b.status).toBe("completed");
});

test("onStream is called with node progress when provided", async () => {
  const streamCalls: Array<{ nodeId: string; text: string }> = [];
  const streamDeps: RunDeps = {
    ...deps,
    onStream: (nodeId, text) => streamCalls.push({ nodeId, text }),
  };
  const def: WorkflowDef = { name: "w", description: "d", nodes: [
    { id: "a", bash: "echo streamed" },
  ] };
  await executeDag(def, seed(def), streamDeps);
  expect(streamCalls.length).toBeGreaterThan(0);
  expect(streamCalls[0].nodeId).toBe("a");
});
