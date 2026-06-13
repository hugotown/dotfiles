// panel/tests/component.test.ts
import { describe, test, expect } from "bun:test";
import { DaddyPanel } from "../component.ts";
import { createStore } from "../store.ts";
import type { RunState } from "../../runtime-types.ts";

const mockDeps = { exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" } as any;

const mockRun: RunState = {
  id: "r1", workflow: "test", arguments: "", status: "running",
  artifacts_dir: "/a", base_branch: "main", started_at: "t",
  nodes: { interview: { status: "running", output: "" }, summary: { status: "pending", output: "" } },
};

function makePanel() {
  const store = createStore();
  store.setRun(mockRun);
  store.appendStream("interview", { type: "text", content: "Analyzing...", timestamp: 1 });
  let closed = false;
  const panel = new DaddyPanel({
    store,
    deps: mockDeps,
    done: () => { closed = true; },
    requestRender: () => {},
  });
  return { panel, store, isClosed: () => closed };
}

describe("DaddyPanel", () => {
  test("render produces lines with title", () => {
    const { panel } = makePanel();
    const lines = panel.render(80);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toContain("Deterministic");
  });

  test("Escape closes the panel", () => {
    const { panel, isClosed } = makePanel();
    panel.handleInput("\x1b");
    expect(isClosed()).toBe(true);
  });

  test("down arrow moves selectedNode", () => {
    const { panel } = makePanel();
    // Initially selected = 0 (interview)
    panel.handleInput("\x1b[B"); // down arrow
    const lines = panel.render(80);
    // Second node should now be selected (summary)
    expect(lines.some((l) => l.includes(">") && l.includes("summary"))).toBe(true);
  });

  test("auto-navigates when waitingForInput changes", () => {
    const { panel, store } = makePanel();
    store.setWaiting("summary", "Confirm?");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes(">") && l.includes("summary"))).toBe(true);
  });
});
