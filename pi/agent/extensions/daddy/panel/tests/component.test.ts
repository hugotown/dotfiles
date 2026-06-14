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

function makePanel(height?: number) {
  const store = createStore();
  store.setRun(mockRun);
  store.appendStream("interview", { type: "text", content: "Analyzing...", timestamp: 1 });
  let closed = false;
  let renders = 0;
  const panel = new DaddyPanel({
    store,
    deps: mockDeps,
    done: () => { closed = true; },
    requestRender: () => { renders++; },
    height,
  });
  return { panel, store, isClosed: () => closed, renderCount: () => renders };
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

  test("keyboard navigation requests a render", () => {
    const { panel, renderCount } = makePanel();
    panel.handleInput("\x1b[B");
    expect(renderCount()).toBe(1);
  });

  test("auto-navigates when waitingForInput changes", () => {
    const { panel, store } = makePanel();
    store.setWaiting("summary", "Confirm?");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes(">") && l.includes("summary"))).toBe(true);
  });

  test("renders live streaming text for the selected node", () => {
    const { panel, store } = makePanel();
    store.setLive("interview", "streaming tokens now");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("streaming tokens now"))).toBe(true);
  });

  test("renders selected node model in the output header", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: {
        interview: { status: "running", output: "", model: "gpt-5.5" },
        summary: { status: "pending", output: "" },
      },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(100);
    expect(lines.some((l) => l.includes("Model: gpt-5.5"))).toBe(true);
  });

  test("keeps the frame right edge at the requested width when left column has ANSI colors", () => {
    const { panel, store } = makePanel(10);
    store.appendStream("interview", { type: "text", content: "x", timestamp: 1 });
    const lines = panel.render(80);
    for (const line of lines) {
      const visible = line.replace(/\x1b\[[0-9;]*m/g, "");
      expect(visible.length).toBe(80);
    }
  });

  test("renders thinking blocks with muted style", () => {
    const { panel, store } = makePanel(20);
    store.appendStream("interview", { type: "thinking", content: "model rationale", timestamp: 1 });
    store.appendStream("interview", { type: "text", content: "Final answer", timestamp: 2 });
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("model rationale"))).toBe(true);
    expect(lines.some((l) => l.includes("Final answer"))).toBe(true);
  });

  test("renders thinking above output when showing completed node state", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      status: "completed",
      nodes: {
        interview: { status: "completed", output: "Visible summary result", thinking: "Reasoning chain" },
        summary: { status: "completed", output: "" },
      },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(80);
    const thinkingIndex = lines.findIndex((l) => l.includes("Reasoning chain"));
    const answerIndex = lines.findIndex((l) => l.includes("Visible summary result"));
    expect(thinkingIndex).toBeGreaterThanOrEqual(0);
    expect(answerIndex).toBeGreaterThan(thinkingIndex);
  });

  test("renders n/a model for non-LLM nodes", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { shell: { status: "completed", output: "ok" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(100);
    expect(lines.some((l) => l.includes("Model: n/a"))).toBe(true);
  });

  test("renders completed node output when no stream history exists", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      status: "completed",
      nodes: {
        interview: { status: "completed", output: "Interview done" },
        summary: { status: "completed", output: "Visible summary result" },
      },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    panel.handleInput("\x1b[B");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("Visible summary result"))).toBe(true);
  });

  test("Page Up scrolls the stream up into history", () => {
    const { panel, store } = makePanel();
    for (let i = 0; i < 60; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    const before = panel.render(80);
    panel.handleInput("\x1b[5~");
    const after = panel.render(80);
    expect(after).not.toEqual(before);
  });

  test("leaves one bottom gutter row below output text", () => {
    const { panel, store } = makePanel(12);
    for (let i = 0; i < 20; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("entry 19"))).toBe(true);
    expect(lines.at(-2)).not.toContain("entry 19");
  });

  test("node navigation resets the scroll offset", () => {
    const { panel, store } = makePanel();
    for (let i = 0; i < 60; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    panel.handleInput("\x1b[5~");
    panel.handleInput("\x1b[B");
    panel.handleInput("\x1b[A");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("entry 59"))).toBe(true);
  });

  test("renders exactly height rows inside a visible frame", () => {
    const { panel } = makePanel(20);
    const lines = panel.render(80);
    expect(lines).toHaveLength(20);
    expect(lines[0].startsWith("╭")).toBe(true);
    expect(lines.at(-1)?.startsWith("╰")).toBe(true);
    expect(lines[0]).toContain("Deterministic");
    expect(lines.some((l) => l.includes("Nodes") && l.includes("Output"))).toBe(true);
  });

  test("keeps the answer editor visible for long questions", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      status: "paused",
      paused_node: "interview",
      nodes: { interview: { status: "paused", output: "What is the main goal of the project and why does it matter for the next milestone?" } },
    });
    store.setWaiting("interview", "What is the main goal of the project and why does it matter for the next milestone?");
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 12 });
    const lines = panel.render(80);
    expect(lines).toHaveLength(12);
    expect(lines.some((l) => l.includes("milestone"))).toBe(true);
    expect(lines.some((l) => l.includes("Answer: > _"))).toBe(true);
    expect(lines.at(-1)?.startsWith("╰")).toBe(true);
  });

  test("auto-navigates to the first running node when the user has not navigated", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "completed", output: "" }, summary: { status: "running", output: "" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {} });
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes(">") && l.includes("summary"))).toBe(true);
  });

  test("does not auto-navigate to running once the user has manually navigated", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "running", output: "" }, summary: { status: "completed", output: "" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {} });
    panel.handleInput("\x1b[B"); // user navigates down
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "running", output: "" }, summary: { status: "running", output: "" } },
    });
    const lines = panel.render(80);
    // Selected is still on "summary" (index 1) — the user-chosen one — not interview (index 0)
    expect(lines.some((l) => l.includes(">") && l.includes("summary"))).toBe(true);
  });

  test("shows a '↓ more' indicator when the stream has hidden history below", () => {
    const { panel, store } = makePanel(20);
    for (let i = 0; i < 200; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("↓ more"))).toBe(true);
  });

  test("shows a '↑ top' indicator when the user has scrolled up", () => {
    const { panel, store } = makePanel(20);
    for (let i = 0; i < 200; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    panel.handleInput("\x1b[5~"); // Page Up
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("↑ top"))).toBe(true);
  });

  test("shows a contextual empty state for a running node with no tokens yet (no ZERO feedback)", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "running", output: "" }, summary: { status: "pending", output: "" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("Streaming"))).toBe(true);
  });

  test("shows a contextual empty state for a pending node", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "completed", output: "" }, summary: { status: "pending", output: "" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    panel.handleInput("\x1b[B"); // navigate to summary
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("Waiting to start"))).toBe(true);
  });

  test("shows the failure error in the empty state when the node failed with no captured output", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      nodes: { interview: { status: "failed", output: "", error: "Network timeout" } },
    });
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("Network timeout"))).toBe(true);
  });

  test("shows paused node output in the stream area even when no stream history exists", () => {
    const store = createStore();
    store.setRun({
      ...mockRun,
      status: "paused",
      paused_node: "interview",
      nodes: { interview: { status: "paused", output: "What is your name?" } },
    });
    store.setWaiting("interview", "What is your name?");
    const panel = new DaddyPanel({ store, deps: mockDeps, done: () => {}, requestRender: () => {}, height: 20 });
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("Question: What is your name?"))).toBe(true);
    expect(lines.some((l) => l.includes("Awaiting your answer below"))).toBe(true);
  });
});
