// index.test.ts
import { test, expect } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import daddy, { attachStreamPersistence } from "./index.ts";
import { createStore } from "./panel/store.ts";
import { loadStreams } from "./lib/state.ts";

function fakePi() {
  const reg = { commands: [] as string[], tools: [] as string[], events: [] as string[] };
  const pi = {
    registerCommand: (name: string) => reg.commands.push(name),
    registerTool: (t: { name: string }) => reg.tools.push(t.name),
    on: (e: string) => reg.events.push(e),
    sendMessage: () => {}, appendEntry: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  };
  return { pi, reg };
}

test("registers command, tool, and session_start hook", () => {
  const { pi, reg } = fakePi();
  daddy(pi as never);
  expect(reg.commands).toContain("daddy");
  expect(reg.tools).toContain("daddy");
  expect(reg.events).toContain("session_start");
});

test("observer command opens a panel overlay", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-idx-"));
  let customCalled = false;
  const pi = {
    registerCommand: (_n: string, opts: { handler: (a: string, c: unknown) => Promise<void> }) => { (pi as any)._handler = opts.handler; },
    registerTool: () => {},
    on: () => {},
    sendMessage: () => {}, appendEntry: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  };
  const ctx = {
    cwd,
    hasUI: true,
    ui: {
      notify: () => {}, setStatus: () => {}, setWorkingMessage: () => {},
      custom: () => { customCalled = true; return Promise.resolve(); },
    },
  };
  daddy(pi as never);
  await (pi as any)._handler("observer", ctx);
  expect(customCalled).toBe(true);
});

test("flow= command opens the panel BEFORE the run starts (auto-open on /daddy flow=X)", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-idx-"));
  let customCalled = false;
  const pi = {
    registerCommand: (_n: string, opts: { handler: (a: string, c: unknown) => Promise<void> }) => { (pi as any)._handler = opts.handler; },
    registerTool: () => {},
    on: () => {},
    sendMessage: () => {}, appendEntry: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  };
  const ctx = {
    cwd,
    hasUI: true,
    ui: {
      notify: () => {}, setStatus: () => {}, setWorkingMessage: () => {},
      custom: () => { customCalled = true; return Promise.resolve(); },
    },
  };
  daddy(pi as never);
  // Use a non-existent flow so startRun throws — we only care that the panel
  // opened, and the try/catch in the handler swallows the error. openPanel
  // is called synchronously before the first await, so the panel must be
  // open by the time the handler returns.
  await (pi as any)._handler("flow=does-not-exist", ctx);
  expect(customCalled).toBe(true);
});

test("stream persistence flushes final paused run output despite throttle", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-stream-flush-"));
  const store = createStore();
  attachStreamPersistence(store, home);
  store.setRun({
    id: "r1", workflow: "w", arguments: "", status: "running",
    artifacts_dir: "/a", base_branch: "main", started_at: "t",
    nodes: { interview: { status: "running", output: "" } },
  });
  store.appendStream("interview", { type: "text", content: "Interview step 2", timestamp: 1 });
  store.appendStream("interview", { type: "text", content: "What project are you working on?", timestamp: 2 });
  store.setRun({
    id: "r1", workflow: "w", arguments: "", status: "paused", paused_node: "interview",
    artifacts_dir: "/a", base_branch: "main", started_at: "t",
    nodes: { interview: { status: "paused", output: "What project are you working on?" } },
  });

  expect(loadStreams(home, "r1").interview.map((e) => e.content)).toEqual([
    "Interview step 2",
    "What project are you working on?",
  ]);
});
