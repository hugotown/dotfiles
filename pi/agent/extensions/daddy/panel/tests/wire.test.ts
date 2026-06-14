import { test, expect } from "bun:test";
import { wrapDeps } from "../wire.ts";
import { createStore } from "../store.ts";
import type { RunDeps, RunState } from "../../runtime-types.ts";

const base: RunDeps = {
  exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunDeps["exec"],
  notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p",
};

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "r1", workflow: "w", arguments: "", status: "running",
  artifacts_dir: "/a", base_branch: "main", started_at: "t",
  nodes: { a: { status: "running", output: "" } }, ...over,
});

test("emit mirrors run into the store", () => {
  const store = createStore();
  wrapDeps(store, base).emit(run());
  expect(store.getState().run?.id).toBe("r1");
});

test("emit sets waiting from the paused node's output", () => {
  const store = createStore();
  const paused = run({ status: "paused", paused_node: "a", nodes: { a: { status: "paused", output: "Approve?" } } });
  wrapDeps(store, base).emit(paused);
  expect(store.getState().waitingForInput).toBe("a");
  expect(store.getState().inputPrompt).toBe("Approve?");
});

test("emit clears waiting when the run is no longer paused", () => {
  const store = createStore();
  const d = wrapDeps(store, base);
  d.emit(run({ status: "paused", paused_node: "a", nodes: { a: { status: "paused", output: "Q" } } }));
  d.emit(run({ status: "running" }));
  expect(store.getState().waitingForInput).toBeNull();
  expect(store.getState().inputPrompt).toBeNull();
});

test("onStream appends final output to history and clears live", () => {
  const store = createStore();
  const d = wrapDeps(store, base);
  d.progress!("a", "live tokens...");
  d.onStream!("a", "final output");
  expect(store.getState().streams.a).toHaveLength(1);
  expect(store.getState().streams.a[0].content).toBe("final output");
  expect(store.getState().live.a).toBeUndefined();
});

test("progress stores live text keyed by the base node id (strips loop suffix)", () => {
  const store = createStore();
  wrapDeps(store, base).progress!("loop #2", "chunk");
  expect(store.getState().live.loop).toBe("chunk");
});

test("preserves the base callbacks (delegates through)", () => {
  let emitted = false;
  const store = createStore();
  wrapDeps(store, { ...base, emit: () => { emitted = true; } }).emit(run());
  expect(emitted).toBe(true);
});

test("collapses consecutive thinking updates into the latest snapshot", () => {
  const store = createStore();
  const d = wrapDeps(store, base);
  d.onThinking!("a", "Plan step 1");
  d.onThinking!("a", "Plan step 1 and 2");
  d.onThinking!("a", "Plan step 1 and 2");
  const entries = (store.getState().streams.a ?? []).filter((e) => e.type === "thinking");
  expect(entries).toHaveLength(1);
  expect(entries[0].content).toBe("Plan step 1 and 2");
});

test("opens a new thinking entry after an interleaved text stream", () => {
  const store = createStore();
  const d = wrapDeps(store, base);
  d.onThinking!("a", "Reason 1");
  d.onStream!("a", "Final answer 1");
  d.onThinking!("a", "Reason 2");
  const entries = store.getState().streams.a ?? [];
  expect(entries.map((e) => e.type)).toEqual(["thinking", "text", "thinking"]);
  expect(entries.filter((e) => e.type === "thinking").map((e) => e.content)).toEqual(["Reason 1", "Reason 2"]);
});
