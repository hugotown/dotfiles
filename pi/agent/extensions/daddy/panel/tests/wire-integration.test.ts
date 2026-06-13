// panel/tests/wire-integration.test.ts — end-to-end: executor emissions drive the
// panel's waiting state and live stream through wrapDeps + DaddyPanel.
import { test, expect } from "bun:test";
import { createStore } from "../store.ts";
import { wrapDeps } from "../wire.ts";
import { DaddyPanel } from "../component.ts";
import type { RunDeps, RunState } from "../../runtime-types.ts";

const base: RunDeps = {
  exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunDeps["exec"],
  notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p",
};

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "r1", workflow: "w", arguments: "", status: "running",
  artifacts_dir: "/a", base_branch: "main", started_at: "t",
  nodes: { interview: { status: "running", output: "" } }, ...over,
});

test("paused emission activates the editor and auto-navigates to the paused node", () => {
  const store = createStore();
  const deps = wrapDeps(store, base);
  const panel = new DaddyPanel({ store, deps, done: () => {}, requestRender: () => {} });

  deps.progress!("interview", "Analyzing request...");
  deps.emit(run({
    status: "paused", paused_node: "interview",
    nodes: { interview: { status: "paused", output: "What is your name?" } },
  }));

  expect(store.getState().waitingForInput).toBe("interview");
  expect(store.getState().inputPrompt).toBe("What is your name?");
  const lines = panel.render(80);
  expect(lines.some((l) => l.includes("interview"))).toBe(true);
});

test("resuming clears the waiting state", () => {
  const store = createStore();
  const deps = wrapDeps(store, base);
  deps.emit(run({
    status: "paused", paused_node: "interview",
    nodes: { interview: { status: "paused", output: "Q?" } },
  }));
  expect(store.getState().waitingForInput).toBe("interview");
  deps.emit(run({ status: "running", nodes: { interview: { status: "completed", output: "done" } } }));
  expect(store.getState().waitingForInput).toBeNull();
});
