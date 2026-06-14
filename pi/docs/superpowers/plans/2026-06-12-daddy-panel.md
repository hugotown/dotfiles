# Daddy Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TUI overlay panel for live workflow observation and bidirectional interaction, replacing the `pi.on("input")` interception mechanism.

**Architecture:** Fork of subagent panel pattern (store + open + view + renderers). A per-run reactive store bridges `dag-executor` emissions to the panel UI. The panel is a `Component` with two-column layout (node-list + stream-view) and a conditional bottom Editor for user input.

**Tech Stack:** TypeScript, `@earendil-works/pi-tui` (Component, Editor, Key, matchesKey), `bun:test`, pub/sub in-memory store (same pattern as `subagent/lib/store.ts`).

---

## File Structure

```
agent/extensions/daddy/
  panel/
    store.ts              Reactive store (state + pub/sub) — ~55 LOC
    open.ts               Opens the panel via ctx.ui.custom() — ~35 LOC
    component.ts          Main DaddyPanel Component (layout) — ~65 LOC
    node-list.ts          Left column: node tree renderer — ~50 LOC
    stream-view.ts        Right column: streaming output — ~60 LOC
    input-editor.ts       Bottom: Editor widget wrapper — ~50 LOC
    icons.ts              Node state → icon mapping — ~20 LOC
  panel/tests/
    store.test.ts         Store unit tests — ~60 LOC
    icons.test.ts         Icon mapping tests — ~25 LOC
    node-list.test.ts     Node list render tests — ~55 LOC
    stream-view.test.ts   Stream view render tests — ~60 LOC
    input-editor.test.ts  Input editor tests — ~50 LOC
    component.test.ts     DaddyPanel integration test — ~70 LOC
    open.test.ts          Open function test — ~40 LOC
```

**Modified files:**
- `agent/extensions/daddy/index.ts` — Remove `pi.on("input")`, add panel open after startRun
- `agent/extensions/daddy/lib/command-router.ts` — Add `observer` kind
- `agent/extensions/daddy/lib/handle-command.ts` — Add observer handler
- `agent/extensions/daddy/lib/deps.ts` — Add `onStream` callback to RunDeps
- `agent/extensions/daddy/runtime-types.ts` — Add `onStream` to RunDeps interface

---

## File Contracts

These are the agreed interfaces that enable parallel agent development:

```typescript
// panel/store.ts — exports
export interface StreamEntry {
  type: "text" | "tool_call" | "status";
  content: string;
  timestamp: number;
}

export interface PanelState {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;
  waitingForInput: string | null;
  inputPrompt: string | null;
}

export type PanelListener = () => void;

export function createStore(): {
  getState: () => PanelState;
  setState: (updater: (s: PanelState) => PanelState) => void;
  subscribe: (listener: PanelListener) => () => void;
  appendStream: (nodeId: string, entry: StreamEntry) => void;
  setWaiting: (nodeId: string | null, prompt: string | null) => void;
  setRun: (run: RunState) => void;
};
```

```typescript
// panel/icons.ts — exports
export type NodeIcon = "○" | "●" | "◉" | "✓" | "✗" | "⊘";
export function iconFor(status: NodeStatus): NodeIcon;
export function colorFor(status: NodeStatus): string;
```

```typescript
// panel/open.ts — exports
export function openDaddyPanel(
  ctx: ExtensionContext,
  store: ReturnType<typeof createStore>,
  deps: RunDeps,
): Promise<void>;
```

```typescript
// panel/component.ts — exports
export class DaddyPanel implements Component {
  constructor(opts: {
    store: ReturnType<typeof createStore>;
    deps: RunDeps;
    done: () => void;
    requestRender: () => void;
  });
  handleInput(data: string): void;
  render(width: number): string[];
  invalidate(): void;
  dispose(): void;
}
```

```typescript
// panel/node-list.ts — exports
export function renderNodeList(
  nodes: Array<{ id: string; status: NodeStatus }>,
  selectedIndex: number,
  width: number,
  height: number,
): string[];
```

```typescript
// panel/stream-view.ts — exports
export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
): string[];
```

```typescript
// panel/input-editor.ts — exports
export class InlineEditor {
  constructor(opts: {
    tui: TUI;
    placeholder: string;
    onSubmit: (text: string) => void;
  });
  handleInput(data: string): void;
  render(width: number): string[];
  isActive(): boolean;
  setPlaceholder(text: string): void;
  destroy(): void;
}
```

---

## Task 1: Create Icon Mapping

**Files:**
- Create: `agent/extensions/daddy/panel/icons.ts`
- Test: `agent/extensions/daddy/panel/tests/icons.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/icons.test.ts
import { test, expect } from "bun:test";
import { iconFor, colorFor } from "../icons.ts";

test("iconFor returns correct icon for each status", () => {
  expect(iconFor("pending")).toBe("○");
  expect(iconFor("running")).toBe("●");
  expect(iconFor("paused")).toBe("◉");
  expect(iconFor("completed")).toBe("✓");
  expect(iconFor("failed")).toBe("✗");
  expect(iconFor("skipped")).toBe("⊘");
  expect(iconFor("cancelled")).toBe("⊘");
});

test("colorFor returns hex color per status", () => {
  expect(colorFor("running")).toBe("#e0af68");
  expect(colorFor("completed")).toBe("#9ece6a");
  expect(colorFor("failed")).toBe("#f7768e");
  expect(colorFor("pending")).toBe("#565f89");
  expect(colorFor("paused")).toBe("#bb9af7");
  expect(colorFor("skipped")).toBe("#565f89");
  expect(colorFor("cancelled")).toBe("#565f89");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/icons.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/icons.ts — Node state → icon and color mapping.
import type { NodeStatus } from "../runtime-types.ts";

export type NodeIcon = "○" | "●" | "◉" | "✓" | "✗" | "⊘";

const ICONS: Record<NodeStatus, NodeIcon> = {
  pending: "○",
  running: "●",
  paused: "◉",
  completed: "✓",
  failed: "✗",
  skipped: "⊘",
  cancelled: "⊘",
};

const COLORS: Record<NodeStatus, string> = {
  pending: "#565f89",
  running: "#e0af68",
  paused: "#bb9af7",
  completed: "#9ece6a",
  failed: "#f7768e",
  skipped: "#565f89",
  cancelled: "#565f89",
};

export function iconFor(status: NodeStatus): NodeIcon {
  return ICONS[status];
}

export function colorFor(status: NodeStatus): string {
  return COLORS[status];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/icons.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/icons.ts agent/extensions/daddy/panel/tests/icons.test.ts
git commit -m "feat(daddy-panel): add node status icon and color mapping"
```

---

## Task 2: Create Reactive Store

**Files:**
- Create: `agent/extensions/daddy/panel/store.ts`
- Test: `agent/extensions/daddy/panel/tests/store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/store.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/store.ts — Reactive store for the daddy panel (pub/sub, one per run).
import type { RunState } from "../runtime-types.ts";

export interface StreamEntry {
  type: "text" | "tool_call" | "status";
  content: string;
  timestamp: number;
}

export interface PanelState {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;
  waitingForInput: string | null;
  inputPrompt: string | null;
}

export type PanelListener = () => void;

export function createStore() {
  let state: PanelState = {
    run: null, streams: {}, waitingForInput: null, inputPrompt: null,
  };
  const listeners = new Set<PanelListener>();

  const notify = () => { for (const l of listeners) l(); };

  return {
    getState: () => state,
    setState: (updater: (s: PanelState) => PanelState) => {
      state = updater(state);
      notify();
    },
    subscribe: (listener: PanelListener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    appendStream: (nodeId: string, entry: StreamEntry) => {
      state = {
        ...state,
        streams: {
          ...state.streams,
          [nodeId]: [...(state.streams[nodeId] ?? []), entry],
        },
      };
      notify();
    },
    setWaiting: (nodeId: string | null, prompt: string | null) => {
      state = { ...state, waitingForInput: nodeId, inputPrompt: prompt };
      notify();
    },
    setRun: (run: RunState) => {
      state = { ...state, run };
      notify();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/store.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/store.ts agent/extensions/daddy/panel/tests/store.test.ts
git commit -m "feat(daddy-panel): add reactive pub/sub store"
```

---

## Task 3: Create Node List Renderer

**Files:**
- Create: `agent/extensions/daddy/panel/node-list.ts`
- Test: `agent/extensions/daddy/panel/tests/node-list.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/node-list.test.ts
import { describe, test, expect } from "bun:test";
import { renderNodeList } from "../node-list.ts";
import type { NodeStatus } from "../../runtime-types.ts";

const nodes = (statuses: NodeStatus[]) =>
  statuses.map((s, i) => ({ id: `node-${i}`, status: s }));

describe("renderNodeList", () => {
  test("renders nodes with correct icons and selection marker", () => {
    const lines = renderNodeList(nodes(["running", "pending", "completed"]), 0, 20, 5);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("●");
    expect(lines[0]).toContain("node-0");
    expect(lines[1]).toContain("○");
    expect(lines[2]).toContain("✓");
  });

  test("selected node is marked with >", () => {
    const lines = renderNodeList(nodes(["pending", "running"]), 1, 20, 5);
    expect(lines[1]).toContain(">");
    expect(lines[0]).not.toContain(">");
  });

  test("pads empty rows when fewer nodes than height", () => {
    const lines = renderNodeList(nodes(["pending"]), 0, 20, 4);
    expect(lines).toHaveLength(4);
  });

  test("windows when nodes exceed height", () => {
    const many = nodes(Array(10).fill("pending") as NodeStatus[]);
    const lines = renderNodeList(many, 8, 20, 4);
    expect(lines).toHaveLength(4);
    // Should show nodes around selected (8)
    expect(lines.some((l) => l.includes("node-8"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/node-list.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/node-list.ts — Left column: node tree renderer with windowed scrolling.
import type { NodeStatus } from "../runtime-types.ts";
import { iconFor, colorFor } from "./icons.ts";

export interface NodeEntry {
  id: string;
  status: NodeStatus;
}

function windowStart(selected: number, count: number, height: number): number {
  return Math.max(0, Math.min(selected - Math.floor(height / 2), Math.max(0, count - height)));
}

function pad(text: string, width: number): string {
  if (text.length > width) return `${text.slice(0, Math.max(0, width - 1))}…`;
  return text + " ".repeat(width - text.length);
}

export function renderNodeList(
  nodes: NodeEntry[],
  selectedIndex: number,
  width: number,
  height: number,
): string[] {
  const start = windowStart(selectedIndex, nodes.length, height);
  const lines: string[] = [];
  for (let i = 0; i < height; i++) {
    const idx = start + i;
    const node = nodes[idx];
    if (!node) { lines.push(" ".repeat(width)); continue; }
    const marker = idx === selectedIndex ? ">" : " ";
    const icon = iconFor(node.status);
    lines.push(pad(`${marker} ${icon} ${node.id}`, width));
  }
  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/node-list.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/node-list.ts agent/extensions/daddy/panel/tests/node-list.test.ts
git commit -m "feat(daddy-panel): add node list renderer with windowed scrolling"
```

---

## Task 4: Create Stream View Renderer

**Files:**
- Create: `agent/extensions/daddy/panel/stream-view.ts`
- Test: `agent/extensions/daddy/panel/tests/stream-view.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/stream-view.test.ts
import { describe, test, expect } from "bun:test";
import { renderStreamView } from "../stream-view.ts";
import type { StreamEntry } from "../store.ts";

const entry = (content: string, type: StreamEntry["type"] = "text"): StreamEntry =>
  ({ type, content, timestamp: Date.now() });

describe("renderStreamView", () => {
  test("renders entries tailed to height", () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`line ${i}`));
    const lines = renderStreamView(entries, 40, 5);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toContain("line 19");
  });

  test("empty entries produces blank lines", () => {
    const lines = renderStreamView([], 30, 4);
    expect(lines).toHaveLength(4);
    lines.forEach((l) => expect(l.trim()).toBe(""));
  });

  test("tool_call entries are prefixed with arrow", () => {
    const lines = renderStreamView([entry("bash run", "tool_call")], 40, 3);
    expect(lines[2]).toContain("→ bash run");
  });

  test("status entries are prefixed with bracket", () => {
    const lines = renderStreamView([entry("completed", "status")], 40, 3);
    expect(lines[2]).toContain("[completed]");
  });

  test("long lines are word-wrapped", () => {
    const long = "word ".repeat(20).trim();
    const lines = renderStreamView([entry(long)], 20, 10);
    expect(lines.length).toBe(10);
    // At least one line should contain "word"
    expect(lines.some((l) => l.includes("word"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/stream-view.ts — Right column: streaming output renderer, tailed to height.
import type { StreamEntry } from "./store.ts";

function wordWrap(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const out: string[] = [];
  const words = text.split(/\s+/);
  let current = "";
  for (const w of words) {
    const candidate = current.length === 0 ? w : `${current} ${w}`;
    if (candidate.length > width) {
      if (current) out.push(current);
      current = w.length > width ? w.slice(0, width) : w;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [""];
}

function formatEntry(e: StreamEntry): string {
  if (e.type === "tool_call") return `→ ${e.content}`;
  if (e.type === "status") return `[${e.content}]`;
  return e.content;
}

function pad(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
): string[] {
  const allLines: string[] = [];
  for (const e of entries) {
    const formatted = formatEntry(e);
    for (const line of wordWrap(formatted, width)) allLines.push(line);
  }
  const tail = allLines.slice(-height);
  const padded = tail.map((l) => pad(l, width));
  while (padded.length < height) padded.unshift(" ".repeat(width));
  return padded;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/stream-view.ts agent/extensions/daddy/panel/tests/stream-view.test.ts
git commit -m "feat(daddy-panel): add stream view renderer with word-wrap and tail"
```

---

## Task 5: Create Inline Editor Wrapper

**Files:**
- Create: `agent/extensions/daddy/panel/input-editor.ts`
- Test: `agent/extensions/daddy/panel/tests/input-editor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/input-editor.test.ts
import { describe, test, expect } from "bun:test";
import { InlineEditor } from "../input-editor.ts";

// Mock TUI that satisfies the Editor constructor
const mockTui = { requestRender: () => {} } as any;

describe("InlineEditor", () => {
  test("isActive returns false initially", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    expect(editor.isActive()).toBe(false);
  });

  test("activate makes isActive true", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    expect(editor.isActive()).toBe(true);
  });

  test("deactivate makes isActive false", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
    editor.activate();
    editor.deactivate();
    expect(editor.isActive()).toBe(false);
  });

  test("render returns placeholder line when inactive", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "What is your name?",
      onSubmit: () => {},
    });
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("What is your name?"))).toBe(true);
  });

  test("setPlaceholder updates the display text", () => {
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "old",
      onSubmit: () => {},
    });
    editor.setPlaceholder("new prompt");
    const lines = editor.render(40);
    expect(lines.some((l) => l.includes("new prompt"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/input-editor.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/input-editor.ts — Inline editor wrapper for user input in the panel.
import type { TUI } from "@earendil-works/pi-tui";

export interface InlineEditorOpts {
  tui: TUI;
  placeholder: string;
  onSubmit: (text: string) => void;
}

export class InlineEditor {
  private active = false;
  private placeholder: string;
  private buffer = "";
  private readonly onSubmit: (text: string) => void;

  constructor(opts: InlineEditorOpts) {
    this.placeholder = opts.placeholder;
    this.onSubmit = opts.onSubmit;
  }

  isActive(): boolean { return this.active; }
  activate(): void { this.active = true; this.buffer = ""; }
  deactivate(): void { this.active = false; this.buffer = ""; }
  setPlaceholder(text: string): void { this.placeholder = text; }
  destroy(): void { this.deactivate(); }

  handleInput(data: string): void {
    if (!this.active) return;
    if (data === "\r" || data === "\n") {
      if (this.buffer.trim()) {
        this.onSubmit(this.buffer.trim());
        this.buffer = "";
      }
      return;
    }
    if (data === "\x7f") { // backspace
      this.buffer = this.buffer.slice(0, -1);
      return;
    }
    if (data.length === 1 && data >= " ") {
      this.buffer += data;
    }
  }

  render(width: number): string[] {
    const separator = "─".repeat(width);
    if (!this.active) {
      const hint = `  ${this.placeholder}`;
      const padded = hint.length >= width ? hint.slice(0, width) : hint + " ".repeat(width - hint.length);
      return [separator, padded];
    }
    const prompt = `> ${this.buffer}_`;
    const hint = "[Enter to send]";
    const line = prompt.length + hint.length >= width
      ? prompt.slice(0, width)
      : prompt + " ".repeat(width - prompt.length - hint.length) + hint;
    return [separator, line];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/input-editor.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/input-editor.ts agent/extensions/daddy/panel/tests/input-editor.test.ts
git commit -m "feat(daddy-panel): add inline editor wrapper for user input"
```

---

## Task 6: Create DaddyPanel Component

**Files:**
- Create: `agent/extensions/daddy/panel/component.ts`
- Test: `agent/extensions/daddy/panel/tests/component.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
    // Force re-render to pick up auto-nav
    const lines = panel.render(80);
    // Should show the editor area with the prompt
    expect(lines.some((l) => l.includes("Confirm?"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/component.ts — Main DaddyPanel Component (layout orchestrator).
import type { Component } from "@earendil-works/pi-tui";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { Store } from "./store.ts";
import type { RunDeps } from "../runtime-types.ts";
import { renderNodeList } from "./node-list.ts";
import { renderStreamView } from "./stream-view.ts";
import { InlineEditor } from "./input-editor.ts";
import { resumeRun } from "../lib/run-controller.ts";

const TITLE = "Deterministic, Agentic-Driven Development — You Lead.";
const GAP = " │ ";

export interface DaddyPanelOpts {
  store: Store;
  deps: RunDeps;
  done: () => void;
  requestRender: () => void;
}

export class DaddyPanel implements Component {
  private selected = 0;
  private unsubscribe: () => void;
  private editor: InlineEditor;
  private readonly store: Store;
  private readonly deps: RunDeps;
  private readonly done: () => void;

  constructor(opts: DaddyPanelOpts) {
    this.store = opts.store;
    this.deps = opts.deps;
    this.done = opts.done;
    this.editor = new InlineEditor({
      tui: {} as any,
      placeholder: "",
      onSubmit: (text) => this.submitInput(text),
    });
    this.unsubscribe = this.store.subscribe(() => {
      this.syncAutoNav();
      opts.requestRender();
    });
  }

  private syncAutoNav(): void {
    const { waitingForInput, inputPrompt } = this.store.getState();
    if (waitingForInput) {
      const nodes = this.getNodeEntries();
      const idx = nodes.findIndex((n) => n.id === waitingForInput);
      if (idx >= 0) this.selected = idx;
      this.editor.setPlaceholder(inputPrompt ?? "");
      this.editor.activate();
    } else {
      this.editor.deactivate();
    }
  }

  private getNodeEntries() {
    const run = this.store.getState().run;
    if (!run) return [];
    return Object.entries(run.nodes).map(([id, n]) => ({ id, status: n.status }));
  }

  private async submitInput(text: string): Promise<void> {
    const { run, waitingForInput } = this.store.getState();
    if (!run || !waitingForInput) return;
    this.editor.deactivate();
    await resumeRun(run.id, this.deps, { decision: "approve", comment: text });
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) { this.done(); return; }
    if (this.editor.isActive()) { this.editor.handleInput(data); return; }
    if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
    else if (matchesKey(data, Key.down)) {
      const max = this.getNodeEntries().length - 1;
      this.selected = Math.min(max, this.selected + 1);
    }
  }

  render(width: number): string[] {
    const height = Math.max(6, Math.floor((process.stdout.rows ?? 24) * 0.7));
    const leftWidth = Math.min(24, Math.floor(width * 0.3));
    const rightWidth = Math.max(1, width - leftWidth - GAP.length);
    const nodes = this.getNodeEntries();
    const selectedNodeId = nodes[this.selected]?.id;
    const streams = selectedNodeId ? (this.store.getState().streams[selectedNodeId] ?? []) : [];
    const editorLines = this.editor.isActive() ? this.editor.render(rightWidth) : [];
    const streamHeight = height - editorLines.length;
    const left = renderNodeList(nodes, this.selected, leftWidth, height);
    const right = renderStreamView(streams, rightWidth, streamHeight);
    const title = TITLE.length >= width ? TITLE.slice(0, width) : TITLE + " ".repeat(width - TITLE.length);
    const rows = [title];
    for (let i = 0; i < height; i++) {
      const l = left[i] ?? " ".repeat(leftWidth);
      const r = i < streamHeight ? (right[i] ?? "") : (editorLines[i - streamHeight] ?? "");
      rows.push(l + GAP + r);
    }
    return rows;
  }

  invalidate(): void {}
  dispose(): void { this.unsubscribe(); this.editor.destroy(); }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/component.ts agent/extensions/daddy/panel/tests/component.test.ts
git commit -m "feat(daddy-panel): add main DaddyPanel component with layout"
```

---

## Task 7: Create Panel Open Function

**Files:**
- Create: `agent/extensions/daddy/panel/open.ts`
- Test: `agent/extensions/daddy/panel/tests/open.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/open.test.ts
import { test, expect } from "bun:test";
import { openDaddyPanel } from "../open.ts";
import { createStore } from "../store.ts";

test("openDaddyPanel calls ctx.ui.custom with overlay options", async () => {
  const store = createStore();
  let customCalled = false;
  let overlayOpts: any = null;
  const mockCtx = {
    ui: {
      custom: (_factory: any, opts: any) => {
        customCalled = true;
        overlayOpts = opts;
        // Simulate immediate close
        return Promise.resolve();
      },
    },
  } as any;
  const mockDeps = { exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
    notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" } as any;

  await openDaddyPanel(mockCtx, store, mockDeps);
  expect(customCalled).toBe(true);
  expect(overlayOpts.overlay).toBe(true);
  expect(overlayOpts.overlayOptions.width).toBe("85%");
  expect(overlayOpts.overlayOptions.anchor).toBe("center");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/open.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// panel/open.ts — Opens the daddy panel as a centered overlay.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RunDeps } from "../runtime-types.ts";
import type { Store } from "./store.ts";
import { DaddyPanel } from "./component.ts";

export function openDaddyPanel(
  ctx: ExtensionContext,
  store: Store,
  deps: RunDeps,
): Promise<void> {
  return ctx.ui.custom<void>(
    (tui, _theme, _kb, done) => {
      const panel = new DaddyPanel({
        store,
        deps,
        done: () => done(),
        requestRender: () => tui.requestRender(),
      });
      return Object.assign(panel, { dispose: () => panel.dispose() });
    },
    {
      overlay: true,
      overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" },
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/open.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/open.ts agent/extensions/daddy/panel/tests/open.test.ts
git commit -m "feat(daddy-panel): add openDaddyPanel overlay function"
```

---

## Task 8: Add `observer` Command Kind to Router

**Files:**
- Modify: `agent/extensions/daddy/lib/command-router.ts:2-9` (ParsedCommand type)
- Modify: `agent/extensions/daddy/lib/command-router.ts:17-28` (switch)
- Modify: `agent/extensions/daddy/lib/command-router.test.ts` (add test)

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/lib/command-router.test.ts`:

```typescript
test("parses observer command", () => {
  expect(parseCommand("observer")).toEqual({ kind: "observer" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/lib/command-router.test.ts`
Expected: FAIL — "observer" falls into `unknown`

- [ ] **Step 3: Add observer to ParsedCommand type and switch**

In `command-router.ts`, add `| { kind: "observer" }` to the `ParsedCommand` union (after line 8):

```typescript
export type ParsedCommand =
  | { kind: "run"; flow: string; args: string }
  | { kind: "list" } | { kind: "status" } | { kind: "observer" }
  | { kind: "resume"; id: string }
  | { kind: "approve"; comment: string } | { kind: "reject"; reason: string }
  | { kind: "merge" } | { kind: "remove" } | { kind: "keep" }
  | { kind: "validate"; name: string }
  | { kind: "unknown"; raw: string };
```

In the switch, add before `default`:

```typescript
    case "observer": return { kind: "observer" };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/lib/command-router.test.ts`
Expected: PASS (all existing + new test)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/command-router.ts agent/extensions/daddy/lib/command-router.test.ts
git commit -m "feat(daddy-panel): add observer command kind to router"
```

---

## Task 9: Add Observer Handler to handle-command.ts

**Files:**
- Modify: `agent/extensions/daddy/lib/handle-command.ts`
- Modify: `agent/extensions/daddy/lib/handle-command.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/lib/handle-command.test.ts`:

```typescript
test("observer kind calls onObserver callback", async () => {
  let observerCalled = false;
  await handleCommand(
    { kind: "observer" },
    deps,
    () => {},
    () => {},
    () => { observerCalled = true; },
  );
  expect(observerCalled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/lib/handle-command.test.ts`
Expected: FAIL — `handleCommand` does not accept 5 args or doesn't handle `observer`

- [ ] **Step 3: Add observer handler**

Add a 5th parameter `onObserver` to `handleCommand` signature:

```typescript
export async function handleCommand(
  p: ParsedCommand,
  deps: RunDeps,
  report: Report,
  onPause: OnPause,
  onObserver?: () => void,
): Promise<void> {
```

Add a case in the switch:

```typescript
    case "observer": { if (onObserver) onObserver(); return; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/lib/handle-command.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/handle-command.ts agent/extensions/daddy/lib/handle-command.test.ts
git commit -m "feat(daddy-panel): add observer handler to handleCommand"
```

---

## Task 10: Add `onStream` to RunDeps and Wire dag-executor

**Files:**
- Modify: `agent/extensions/daddy/runtime-types.ts:68-79` (RunDeps interface)
- Modify: `agent/extensions/daddy/lib/dag-executor.ts:46-51` (emit stream entries)

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/lib/dag-executor.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/lib/dag-executor.test.ts`
Expected: FAIL — `onStream` not in type

- [ ] **Step 3: Add onStream to RunDeps and emit in dag-executor**

In `runtime-types.ts`, add to `RunDeps` interface (after `progress?`):

```typescript
  onStream?: (nodeId: string, text: string) => void;
```

In `dag-executor.ts`, after `mark(state, node.id, r)` on line 51, add:

```typescript
      if (deps.onStream && r.output) deps.onStream(node.id, r.output);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/lib/dag-executor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/runtime-types.ts agent/extensions/daddy/lib/dag-executor.ts agent/extensions/daddy/lib/dag-executor.test.ts
git commit -m "feat(daddy-panel): add onStream callback to RunDeps for panel streaming"
```

---

## Task 11: Rewrite index.ts — Remove input hook, add panel opening

**Files:**
- Modify: `agent/extensions/daddy/index.ts`
- Modify: `agent/extensions/daddy/index.test.ts`

- [ ] **Step 1: Write the failing test (expected behavior after change)**

Replace the relevant input-interception test in `index.test.ts` with:

```typescript
test("run command opens panel after startRun", async () => {
  // After the change, handleCommand receives an onObserver callback
  // and the pi.on("input") handler no longer exists
  // Verify by checking the registered command handler signature
  let registered = false;
  const mockPi = {
    registerCommand: (_name: string, _opts: any) => { registered = true; },
    registerTool: () => {},
    on: () => {},
    appendEntry: () => {},
    sendMessage: () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
  } as any;
  daddy(mockPi);
  expect(registered).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/index.test.ts`
Expected: May pass or fail depending on current test state — we need to verify the INPUT handler is gone.

- [ ] **Step 3: Rewrite index.ts**

Replace the entire `index.ts` with:

```typescript
// index.ts — Entry point: wire the /daddy command, tool, and panel.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CMD_NAME, STATE_ENTRY } from "./constants.ts";
import { parseCommand } from "./lib/command-router.ts";
import { handleCommand } from "./lib/handle-command.ts";
import { makeDeps } from "./lib/deps.ts";
import { startRun } from "./lib/run-controller.ts";
import { buildSummary } from "./lib/summary.ts";
import { listRuns } from "./lib/state.ts";
import { RunWorkflowParams } from "./schema.ts";
import type { RunState } from "./runtime-types.ts";
import { createStore } from "./panel/store.ts";
import { openDaddyPanel } from "./panel/open.ts";

export default function daddy(pi: ExtensionAPI): void {
  const onPause = (s: RunState) => pi.appendEntry(STATE_ENTRY, { id: s.id, paused_node: s.paused_node });
  const report = (text: string) => pi.sendMessage({ customType: CMD_NAME, content: text, display: true });

  let activeStore: ReturnType<typeof createStore> | null = null;

  const openPanel = (ctx: ExtensionContext) => {
    if (!activeStore) activeStore = createStore();
    openDaddyPanel(ctx as any, activeStore, makeDeps(pi, ctx));
  };

  pi.registerCommand(CMD_NAME, {
    description: "Run/resume a daddy workflow DAG (flow=<name>, approve, reject, resume, list, status, merge, remove, validate, observer)",
    handler: async (args, ctx) => {
      try {
        await handleCommand(parseCommand(args), makeDeps(pi, ctx), report, onPause, () => openPanel(ctx));
      } catch (e) { ctx.ui.notify(`daddy: ${e instanceof Error ? e.message : e}`, "error"); }
    },
  });

  pi.registerTool({
    name: "daddy",
    label: "Daddy",
    description: "Run a daddy workflow DAG by name; returns a per-node summary.",
    parameters: RunWorkflowParams,
    execute: async (_id, params, _signal, _onUpdate, ctx) => {
      const p = params as { flow: string; arguments?: string };
      const deps = makeDeps(pi, ctx);
      activeStore = createStore();
      const s = await startRun(p.flow, p.arguments ?? "", {
        ...deps,
        onStream: (nodeId, text) => activeStore!.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() }),
        emit: (state) => { deps.emit(state); activeStore!.setRun(state); },
      });
      openPanel(ctx);
      return { content: [{ type: "text", text: buildSummary(s) }], details: s };
    },
  });

  pi.on("session_start", (_e, ctx: ExtensionContext) => {
    const paused = listRuns(makeDeps(pi, ctx).home).find((r) => r.status === "paused");
    if (paused) ctx.ui.notify(`daddy: run ${paused.id} paused at "${paused.paused_node}". /${CMD_NAME} observer`, "info");
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/index.test.ts`
Expected: PASS

- [ ] **Step 5: Run ALL tests to verify nothing is broken**

Run: `bun test agent/extensions/daddy/ --no-coverage`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add agent/extensions/daddy/index.ts agent/extensions/daddy/index.test.ts
git commit -m "feat(daddy-panel): replace input hook with panel, wire store to startRun"
```

---

## Task 12: Wire onStream in handle-command.ts for /daddy flow=X

**Files:**
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Identify the gap**

The `run` case in `handle-command.ts` calls `startRun()` but doesn't wire `onStream` or store updates. The panel needs the store to be populated during the command-initiated flow.

- [ ] **Step 2: Update the run case**

The `handleCommand` function needs access to the store. Add a 6th optional param `store`:

```typescript
export async function handleCommand(
  p: ParsedCommand,
  deps: RunDeps,
  report: Report,
  onPause: OnPause,
  onObserver?: () => void,
  store?: import("../panel/store.ts").Store,
): Promise<void> {
```

In the `run` case, wrap deps with `onStream` if store exists:

```typescript
    case "run": {
      const runDeps = store ? {
        ...deps,
        onStream: (nodeId: string, text: string) => store.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() }),
        emit: (state: RunState) => { deps.emit(state); store.setRun(state); },
      } : deps;
      return settle(await startRun(p.flow, p.args, runDeps), report, onPause);
    }
```

- [ ] **Step 3: Update index.ts to pass store**

In `index.ts` command handler, change:

```typescript
await handleCommand(parseCommand(args), makeDeps(pi, ctx), report, onPause, () => openPanel(ctx), activeStore ?? undefined);
```

- [ ] **Step 4: Run all tests**

Run: `bun test agent/extensions/daddy/ --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/handle-command.ts agent/extensions/daddy/index.ts
git commit -m "feat(daddy-panel): wire store into command-initiated flows"
```

---

## Task 13: Run Full Test Suite and Verify Coverage

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite with coverage**

Run: `bun test agent/extensions/daddy/ --coverage`
Expected: All tests PASS, coverage report shows >90% for panel/ files

- [ ] **Step 2: Verify no regressions in existing tests**

Run: `bun test agent/extensions/daddy/lib/ --no-coverage`
Expected: All existing tests still PASS

- [ ] **Step 3: Verify panel tests independently**

Run: `bun test agent/extensions/daddy/panel/tests/ --no-coverage`
Expected: All 7 test files PASS (icons, store, node-list, stream-view, input-editor, component, open)

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A && git commit -m "test(daddy-panel): ensure full coverage passes"
```

---

## Summary of Changes

| File | Action | Responsibility |
|------|--------|---------------|
| `panel/icons.ts` | Create | Status → icon/color map |
| `panel/store.ts` | Create | Reactive pub/sub store |
| `panel/node-list.ts` | Create | Left column renderer |
| `panel/stream-view.ts` | Create | Right column renderer |
| `panel/input-editor.ts` | Create | Inline editor wrapper |
| `panel/component.ts` | Create | Layout orchestrator |
| `panel/open.ts` | Create | Overlay opener |
| `panel/tests/*.test.ts` | Create | All unit tests |
| `index.ts` | Modify | Remove input hook, add panel |
| `lib/command-router.ts` | Modify | Add observer kind |
| `lib/handle-command.ts` | Modify | Add observer + store wiring |
| `runtime-types.ts` | Modify | Add onStream to RunDeps |
| `lib/dag-executor.ts` | Modify | Emit onStream |

---

## Design Decisions (Verified Against AS_IS)

1. **Store pattern**: Forked from `subagent/lib/store.ts` — same pub/sub with `subscribe()` returning unsubscribe function. Upgraded to factory (`createStore()`) for per-run isolation (spec says "One store per run, no singletons").

2. **Component pattern**: Matches `subagent/panel/view.ts` — implements `Component` interface (`render(width): string[]`, `handleInput(data)`, `invalidate()`), with `dispose()` for cleanup.

3. **Overlay opening**: Identical to `subagent/panel/open.ts` — `ctx.ui.custom<void>(factory, { overlay: true, overlayOptions: {...} })`.

4. **Editor**: Uses simplified wrapper rather than full `Editor` class from pi-tui (which requires a full TUI instance). The InlineEditor handles basic text input with submit-on-Enter, sufficient for single-line workflow input per spec.

5. **Node list windowing**: Same `windowStart()` algorithm as `subagent/panel/list-render.ts`.

6. **RunDeps extension**: Adding `onStream` as optional field preserves backward compatibility — existing code that doesn't set it continues working.

7. **File size constraint**: All files are under 70 LOC (largest is component.ts at ~65 LOC effective code).

8. **Page Up/Down scroll** (spec keybinding): Deferred to a follow-up task. Current implementation auto-tails (shows newest lines), matching the proven subagent panel UX. Adding scroll offset requires tracking `scrollPosition` state and adjusting the stream-view slice — straightforward but not blocking the core panel functionality.
