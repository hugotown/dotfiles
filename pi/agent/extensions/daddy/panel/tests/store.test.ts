// panel/tests/store.test.ts
import { describe, test, expect } from "bun:test";
import { createStore } from "../store.ts";
import type { RunState } from "../../runtime-types.ts";

const mockRun: RunState = {
  id: "r1", workflow: "test", arguments: "", status: "running",
  artifacts_dir: "/a", base_branch: "main", started_at: "t",
  nodes: { a: { status: "running", output: "" } },
};

describe("createStore", () => {
  test("initial state is empty", () => {
    const store = createStore();
    const s = store.getState();
    expect(s.run).toBeNull();
    expect(s.streams).toEqual({});
    expect(s.waitingForInput).toBeNull();
    expect(s.inputPrompt).toBeNull();
  });

  test("setRun updates run and notifies subscribers", () => {
    const store = createStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.setRun(mockRun);
    expect(store.getState().run).toEqual(mockRun);
    expect(calls).toBe(1);
  });

  test("appendStream appends entry to correct nodeId", () => {
    const store = createStore();
    store.appendStream("a", { type: "text", content: "hello", timestamp: 1 });
    store.appendStream("a", { type: "tool_call", content: "bash", timestamp: 2 });
    expect(store.getState().streams.a).toHaveLength(2);
    expect(store.getState().streams.a[0].content).toBe("hello");
  });

  test("setWaiting updates waiting fields", () => {
    const store = createStore();
    store.setWaiting("node-x", "What is your name?");
    const s = store.getState();
    expect(s.waitingForInput).toBe("node-x");
    expect(s.inputPrompt).toBe("What is your name?");
  });

  test("unsubscribe stops notifications", () => {
    const store = createStore();
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.setRun(mockRun);
    expect(calls).toBe(1);
    unsub();
    store.setRun({ ...mockRun, id: "r2" });
    expect(calls).toBe(1);
  });

  test("setState with custom updater", () => {
    const store = createStore();
    store.setState((s) => ({ ...s, inputPrompt: "custom" }));
    expect(store.getState().inputPrompt).toBe("custom");
  });

  test("initial state has empty live map", () => {
    expect(createStore().getState().live).toEqual({});
  });

  test("setLive replaces live text per node", () => {
    const store = createStore();
    store.setLive("a", "partial 1");
    store.setLive("a", "partial 2");
    expect(store.getState().live.a).toBe("partial 2");
  });

  test("setLive notifies subscribers", () => {
    const store = createStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.setLive("a", "x");
    expect(calls).toBe(1);
  });

  test("clearLive removes the node's live text", () => {
    const store = createStore();
    store.setLive("a", "x");
    store.clearLive("a");
    expect(store.getState().live.a).toBeUndefined();
  });
});
