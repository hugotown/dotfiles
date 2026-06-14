# Daddy Panel Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daddy panel actually deliver live workflow observation and bidirectional interaction — fixing the four critical gaps (dead `setWaiting` bridge, no auto-open on `/daddy flow=X`, store not wired on the slash path, non-live panel) plus the streaming, color, hydration and cleanup issues found in code review.

**Architecture:** A single bridge module (`panel/wire.ts`) centralizes all dag-executor → store wiring (DRY): `emit` mirrors `RunState` into the store AND derives `waitingForInput`/`inputPrompt` from a paused node; `onStream` records final per-node output as history; `progress` records live cumulative text. `index.ts` builds the wrapped deps ONCE and passes the SAME wrapped deps to both the run engine and the panel, so input submitted in the panel editor (`resumeRun`) also drives the store live. The panel opens BEFORE the run starts (non-blocking) so observation is live.

**Tech Stack:** TypeScript, `@earendil-works/pi-tui` (Component, Key, matchesKey, truecolor ANSI), `bun:test`, in-memory pub/sub store.

---

## Context: What's Broken (verified against code)

The prior plan (`2026-06-12-daddy-panel.md`) shipped clean units but the feature is non-functional end-to-end:

1. **Bidirectional input dead** — `store.setWaiting()` is called ONLY in tests. `component.ts:46` activates the editor solely from `waitingForInput`, which never gets set in production. When `approval.ts:10` returns `{status:"paused"}`, `dag-executor.ts:28` sets `state.status="paused"` and `emit→setRun` updates `run`, but nothing sets `waitingForInput`. Editor never appears.
2. **`/daddy flow=X` never opens the panel** — `handle-command.ts` `run` case never calls the open callback. Spec decision table requires auto-open on start.
3. **Slash-command run captures nothing** — `index.ts:30` passes `activeStore ?? undefined`; on a fresh session `activeStore` is `null` (only the tool path creates it), so the run case wires `store === undefined`.
4. **Panel is not live** — `index.ts:44-49` does `await startRun(...)` (which runs the whole DAG) THEN `openPanel`. The panel opens on an already-finished snapshot.
5. **Stream view is not real streaming** — live cumulative output goes through `deps.progress` (→ `ctx.ui.setWorkingMessage`), never the store. The panel's `onStream` (`dag-executor.ts:51`) fires once per node post-completion.
6. **`colorFor` is dead** — imported in `node-list.ts:3`, never used; the panel emits no color despite the spec asking for colored node states.
7. **`resumeRun` from the editor freezes the panel** — `component.ts:67` calls `resumeRun(run.id, this.deps, ...)`; `this.deps` is the RAW deps, so the resumed run does not update the store.

> Note: the spec's premise that this "replaces `pi.on('input')`" is moot — the committed `index.ts` never had such a handler. No removal action is needed.

---

## File Structure

```
agent/extensions/daddy/
  panel/
    store.ts            Modify  + live state, setLive/clearLive
    wire.ts             Create  wrapDeps(store, base): single bridge (DRY)
    node-list.ts        Modify  apply colorFor via truecolor ANSI
    stream-view.ts      Modify  height<=0 guard; toLines + bottomOffset scroll
    component.ts         Modify  render live text; Page Up/Down scroll
    input-editor.ts     Modify  drop unused `tui` field
    open.ts             (unchanged — receives wrapped deps from caller)
  panel/tests/
    store.test.ts       Modify  + live tests
    wire.test.ts        Create  bridge tests
    node-list.test.ts   Modify  + color test
    stream-view.test.ts Modify  + guard, toLines, offset tests
    component.test.ts   Modify  + live render + scroll tests
    input-editor.test.ts Modify drop tui from mocks
    wire-integration.test.ts Create end-to-end pause→waiting→resume
  lib/handle-command.ts       Modify  drop dead `store?` param; run case uses given deps
  lib/handle-command.test.ts  (unchanged — already passes 4/5 args)
  index.ts            Modify  wrap once, open-before-run, auto-open, single-panel guard, observer hydration
  index.test.ts       Modify  + observer-opens-panel test
```

---

## File Contracts

```typescript
// panel/store.ts — additions to PanelState and createStore() return
export interface PanelState {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;
  live: Record<string, string>;          // NEW: nodeId → current cumulative live text
  waitingForInput: string | null;
  inputPrompt: string | null;
}
// createStore() also returns:
//   setLive: (nodeId: string, text: string) => void;
//   clearLive: (nodeId: string) => void;
```

```typescript
// panel/wire.ts — exports
import type { RunDeps } from "../runtime-types.ts";
import type { Store } from "./store.ts";
export function wrapDeps(store: Store, base: RunDeps): RunDeps;
```

---

## Task 1: Store — add live state

**Files:**
- Modify: `agent/extensions/daddy/panel/store.ts`
- Test: `agent/extensions/daddy/panel/tests/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `agent/extensions/daddy/panel/tests/store.test.ts` inside the `describe("createStore", ...)` block:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test agent/extensions/daddy/panel/tests/store.test.ts`
Expected: FAIL — `live` is undefined / `setLive` is not a function.

- [ ] **Step 3: Implement**

In `agent/extensions/daddy/panel/store.ts`, add `live` to the interface:

```typescript
export interface PanelState {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;
  live: Record<string, string>;
  waitingForInput: string | null;
  inputPrompt: string | null;
}
```

Update the initial state:

```typescript
  let state: PanelState = {
    run: null, streams: {}, live: {}, waitingForInput: null, inputPrompt: null,
  };
```

Add these two methods to the returned object (after `appendStream`):

```typescript
    setLive: (nodeId: string, text: string) => {
      state = { ...state, live: { ...state.live, [nodeId]: text } };
      notify();
    },
    clearLive: (nodeId: string) => {
      const { [nodeId]: _omit, ...rest } = state.live;
      state = { ...state, live: rest };
      notify();
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test agent/extensions/daddy/panel/tests/store.test.ts`
Expected: PASS (all prior + 4 new)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/store.ts agent/extensions/daddy/panel/tests/store.test.ts
git commit -m "feat(daddy-panel): add live text state to store"
```

---

## Task 2: Create the wire bridge (wrapDeps)

**Files:**
- Create: `agent/extensions/daddy/panel/wire.ts`
- Test: `agent/extensions/daddy/panel/tests/wire.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// panel/tests/wire.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/wire.test.ts`
Expected: FAIL with "Cannot find module ../wire.ts"

- [ ] **Step 3: Implement**

```typescript
// panel/wire.ts — Single bridge from dag-executor emissions to the panel store.
// One place wires onStream/progress/emit so the slash command, the tool, and
// resume-from-editor all keep the panel live and consistent.
import type { RunDeps, RunState } from "../runtime-types.ts";
import type { Store } from "./store.ts";

// Loop nodes emit progress under a decorated id like "build #2"; the node list
// only knows the base id, so strip the iteration suffix for live attribution.
function baseNodeId(id: string): string {
  return id.replace(/ #\d+$/, "");
}

export function wrapDeps(store: Store, base: RunDeps): RunDeps {
  return {
    ...base,
    emit: (state: RunState) => {
      base.emit(state);
      store.setRun(state);
      if (state.status === "paused" && state.paused_node) {
        store.setWaiting(state.paused_node, state.nodes[state.paused_node]?.output ?? "");
      } else {
        store.setWaiting(null, null);
      }
    },
    onStream: (nodeId: string, text: string) => {
      base.onStream?.(nodeId, text);
      store.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() });
      store.clearLive(nodeId);
    },
    progress: (nodeId: string, text: string) => {
      base.progress?.(nodeId, text);
      store.setLive(baseNodeId(nodeId), text);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/wire.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/wire.ts agent/extensions/daddy/panel/tests/wire.test.ts
git commit -m "feat(daddy-panel): add wrapDeps bridge wiring executor to store"
```

---

## Task 3: Node list — apply status color

**Files:**
- Modify: `agent/extensions/daddy/panel/node-list.ts`
- Test: `agent/extensions/daddy/panel/tests/node-list.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/panel/tests/node-list.test.ts` inside the `describe`:

```typescript
  test("applies status color to node rows via truecolor ANSI", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 20, 1);
    expect(lines[0]).toContain("\x1b[38;2;");   // truecolor foreground opener
    expect(lines[0]).toContain("\x1b[39m");      // foreground reset
    expect(lines[0]).toContain("●");             // plain content preserved
    expect(lines[0]).toContain("node-0");
  });

  test("empty padding rows are not colored", () => {
    const lines = renderNodeList(nodes(["running"]), 0, 20, 3);
    expect(lines[1]).not.toContain("\x1b[");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/node-list.test.ts`
Expected: FAIL — output has no ANSI escapes.

- [ ] **Step 3: Implement**

In `agent/extensions/daddy/panel/node-list.ts`, add a paint helper after the `pad` function:

```typescript
function paintFg(hex: string, text: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}
```

Change the row push inside the loop from:

```typescript
    const marker = idx === selectedIndex ? ">" : " ";
    const icon = iconFor(node.status);
    lines.push(pad(`${marker} ${icon} ${node.id}`, width));
```

to (note: pad on PLAIN text first, color after — ANSI is zero-width so alignment holds):

```typescript
    const marker = idx === selectedIndex ? ">" : " ";
    const icon = iconFor(node.status);
    const plain = pad(`${marker} ${icon} ${node.id}`, width);
    lines.push(paintFg(colorFor(node.status), plain));
```

`colorFor` is already imported on line 3 (this resolves the dead-import finding).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/node-list.test.ts`
Expected: PASS (all prior + 2 new). Existing `toContain("●")`, `toContain(">")`, `toContain("node-N")` assertions still pass because the plain substrings remain present.

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/node-list.ts agent/extensions/daddy/panel/tests/node-list.test.ts
git commit -m "feat(daddy-panel): color node rows by status (use colorFor)"
```

---

## Task 4: Stream view — guard zero height

**Files:**
- Modify: `agent/extensions/daddy/panel/stream-view.ts`
- Test: `agent/extensions/daddy/panel/tests/stream-view.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/panel/tests/stream-view.test.ts` inside the `describe`:

```typescript
  test("returns an empty array when height is zero", () => {
    expect(renderStreamView([entry("x")], 20, 0)).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: FAIL — `slice(-0)` returns all lines, so the result is not `[]`.

- [ ] **Step 3: Implement**

In `agent/extensions/daddy/panel/stream-view.ts`, add a guard as the first line of `renderStreamView`:

```typescript
export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
): string[] {
  if (height <= 0) return [];
  const allLines: string[] = [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: PASS (all prior + 1 new)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/stream-view.ts agent/extensions/daddy/panel/tests/stream-view.test.ts
git commit -m "fix(daddy-panel): guard renderStreamView against zero height"
```

---

## Task 5: Component — render live text for the selected node

**Files:**
- Modify: `agent/extensions/daddy/panel/component.ts`
- Test: `agent/extensions/daddy/panel/tests/component.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/panel/tests/component.test.ts` inside the `describe("DaddyPanel", ...)`:

```typescript
  test("renders live streaming text for the selected node", () => {
    const { panel, store } = makePanel();
    store.setLive("interview", "streaming tokens now");
    const lines = panel.render(80);
    expect(lines.some((l) => l.includes("streaming tokens now"))).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: FAIL — live text is not rendered.

- [ ] **Step 3: Implement**

In `agent/extensions/daddy/panel/component.ts`, replace the `streams` line in `render()`:

```typescript
    const streams = selectedNodeId ? (this.store.getState().streams[selectedNodeId] ?? []) : [];
```

with (append the live cumulative text, if any, as a trailing transient entry so `renderStreamView` stays pure):

```typescript
    const state = this.store.getState();
    const history = selectedNodeId ? (state.streams[selectedNodeId] ?? []) : [];
    const liveText = selectedNodeId ? state.live[selectedNodeId] : undefined;
    const streams = liveText
      ? [...history, { type: "text" as const, content: liveText, timestamp: 0 }]
      : history;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: PASS (all prior + 1 new)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/component.ts agent/extensions/daddy/panel/tests/component.test.ts
git commit -m "feat(daddy-panel): render live streaming text in stream view"
```

---

## Task 6: handle-command — drop dead store param

**Files:**
- Modify: `agent/extensions/daddy/lib/handle-command.ts`

- [ ] **Step 1: Confirm current tests pass before change**

Run: `bun test agent/extensions/daddy/lib/handle-command.test.ts`
Expected: PASS (baseline)

- [ ] **Step 2: Remove the `store?` param and inline wiring**

In `agent/extensions/daddy/lib/handle-command.ts`, change the signature (line 19) from:

```typescript
export async function handleCommand(p: ParsedCommand, deps: RunDeps, report: Report, onPause: OnPause, onObserver?: () => void, store?: import("../panel/store.ts").Store): Promise<void> {
```

to:

```typescript
export async function handleCommand(p: ParsedCommand, deps: RunDeps, report: Report, onPause: OnPause, onObserver?: () => void): Promise<void> {
```

Replace the `run` case (the block currently wrapping deps with `store`):

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

with (the caller now supplies already-wrapped deps — see Task 7):

```typescript
    case "run": return settle(await startRun(p.flow, p.args, deps), report, onPause);
```

> The `observer` case and `onObserver` param stay as-is. `RunState` may now be unused as a value import; keep it only if still referenced (it is used elsewhere via `OnPause`/`settle` type annotations — leave the existing `import type ... RunState` line untouched).

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun test agent/extensions/daddy/lib/handle-command.test.ts`
Expected: PASS (existing observer test passes 5 args; run/list/etc pass 4 — all still valid)

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit -p agent/extensions/daddy/tsconfig.json`
Expected: exit 0 (no unused-symbol errors)

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/handle-command.ts
git commit -m "refactor(daddy-panel): drop dead store param from handleCommand"
```

---

## Task 7: index.ts — wire once, open live, auto-open, hydrate observer

**Files:**
- Modify: `agent/extensions/daddy/index.ts`
- Test: `agent/extensions/daddy/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent/extensions/daddy/index.test.ts`:

```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test agent/extensions/daddy/index.test.ts`
Expected: FAIL — current `observer` path routes through `handleCommand`'s `onObserver` which calls the old `openPanel(ctx)` that uses raw deps; with the rewrite not yet in place the registered handler shape differs / panel not opened deterministically.

- [ ] **Step 3: Rewrite `index.ts`**

Replace the entire file `agent/extensions/daddy/index.ts` with:

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
import type { RunDeps, RunState } from "./runtime-types.ts";
import { createStore, type Store } from "./panel/store.ts";
import { openDaddyPanel } from "./panel/open.ts";
import { wrapDeps } from "./panel/wire.ts";

export default function daddy(pi: ExtensionAPI): void {
  const onPause = (s: RunState) => pi.appendEntry(STATE_ENTRY, { id: s.id, paused_node: s.paused_node });
  const report = (text: string) => pi.sendMessage({ customType: CMD_NAME, content: text, display: true });

  let activeStore: Store | null = null;
  let panelOpen = false;

  // Open exactly one panel; reset the guard when the user closes it (Escape).
  const openPanel = (ctx: ExtensionContext, store: Store, deps: RunDeps) => {
    if (panelOpen || !ctx.hasUI) return;
    panelOpen = true;
    void openDaddyPanel(ctx, store, deps).finally(() => { panelOpen = false; });
  };

  // For `/daddy observer` in a session that never ran a workflow: rebuild what we
  // can from the persisted run (statuses + the paused prompt). Streams are
  // in-memory only and cannot be recovered, but the node tree and editor work.
  const hydrate = (store: Store, home: string) => {
    const runs = listRuns(home);
    const run = runs.find((r) => r.status === "paused") ?? runs.find((r) => r.status === "running");
    if (!run) return;
    store.setRun(run);
    if (run.status === "paused" && run.paused_node) {
      store.setWaiting(run.paused_node, run.nodes[run.paused_node]?.output ?? "");
    }
  };

  pi.registerCommand(CMD_NAME, {
    description: "Run/resume a daddy workflow DAG (flow=<name>, approve, reject, resume, list, status, merge, remove, validate, observer)",
    handler: async (args, ctx) => {
      try {
        const parsed = parseCommand(args);
        const base = makeDeps(pi, ctx);
        if (parsed.kind === "run") {
          activeStore = createStore();
          const deps = wrapDeps(activeStore, base);
          openPanel(ctx, activeStore, deps);                 // open BEFORE running → live
          await handleCommand(parsed, deps, report, onPause);
          return;
        }
        const onObserver = () => {
          if (!activeStore) { activeStore = createStore(); hydrate(activeStore, base.home); }
          openPanel(ctx, activeStore, wrapDeps(activeStore, base));
        };
        const deps = activeStore ? wrapDeps(activeStore, base) : base;
        await handleCommand(parsed, deps, report, onPause, onObserver);
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
      activeStore = createStore();
      const deps = wrapDeps(activeStore, makeDeps(pi, ctx));
      openPanel(ctx, activeStore, deps);                     // open BEFORE running → live
      const s = await startRun(p.flow, p.arguments ?? "", deps);
      return { content: [{ type: "text", text: buildSummary(s) }], details: s };
    },
  });

  pi.on("session_start", (_e, ctx: ExtensionContext) => {
    const paused = listRuns(makeDeps(pi, ctx).home).find((r) => r.status === "paused");
    if (paused) ctx.ui.notify(`daddy: run ${paused.id} paused at "${paused.paused_node}". /${CMD_NAME} observer`, "info");
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test agent/extensions/daddy/index.test.ts`
Expected: PASS (registration test + observer-opens-panel test)

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit -p agent/extensions/daddy/tsconfig.json`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add agent/extensions/daddy/index.ts agent/extensions/daddy/index.test.ts
git commit -m "feat(daddy-panel): open panel live, auto-open on run, hydrate observer"
```

---

## Task 8: Input editor — remove unused `tui`

**Files:**
- Modify: `agent/extensions/daddy/panel/input-editor.ts`
- Modify: `agent/extensions/daddy/panel/component.ts`
- Test: `agent/extensions/daddy/panel/tests/input-editor.test.ts`

- [ ] **Step 1: Update the tests to drop `tui`**

In `agent/extensions/daddy/panel/tests/input-editor.test.ts`, remove the mock and the `tui:` property from every `new InlineEditor({ ... })` call. Delete this line near the top:

```typescript
const mockTui = { requestRender: () => {} } as any;
```

And change each constructor call from e.g.:

```typescript
    const editor = new InlineEditor({
      tui: mockTui,
      placeholder: "type here",
      onSubmit: () => {},
    });
```

to:

```typescript
    const editor = new InlineEditor({
      placeholder: "type here",
      onSubmit: () => {},
    });
```

(Apply to all five `new InlineEditor` calls.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test agent/extensions/daddy/panel/tests/input-editor.test.ts`
Expected: FAIL — `tui` is still required by `InlineEditorOpts` (excess-property check) OR mock removed but type still demands `tui`. (If bun's runtime ignores types, this step instead verifies via tsc in Step 4.)

- [ ] **Step 3: Implement — drop `tui` from the type**

In `agent/extensions/daddy/panel/input-editor.ts`, remove the import and the field:

```typescript
import type { TUI } from "@earendil-works/pi-tui";
```

Delete that line. Change the options interface from:

```typescript
export interface InlineEditorOpts {
  tui: TUI;
  placeholder: string;
  onSubmit: (text: string) => void;
}
```

to:

```typescript
export interface InlineEditorOpts {
  placeholder: string;
  onSubmit: (text: string) => void;
}
```

In `agent/extensions/daddy/panel/component.ts`, change the editor construction from:

```typescript
    this.editor = new InlineEditor({
      tui: {} as any,
      placeholder: "",
      onSubmit: (text) => this.submitInput(text),
    });
```

to:

```typescript
    this.editor = new InlineEditor({
      placeholder: "",
      onSubmit: (text) => this.submitInput(text),
    });
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `bun test agent/extensions/daddy/panel/tests/input-editor.test.ts`
Run: `bunx tsc --noEmit -p agent/extensions/daddy/tsconfig.json`
Expected: tests PASS, tsc exit 0

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/input-editor.ts agent/extensions/daddy/panel/component.ts agent/extensions/daddy/panel/tests/input-editor.test.ts
git commit -m "refactor(daddy-panel): drop unused tui field from InlineEditor"
```

---

## Task 9: Stream view scroll (Page Up/Down)

Closes the one spec keybinding the prior plan deferred (spec "Keybindings" table: *Page Up/Down → Scroll stream view*). `Key.pageUp`/`Key.pageDown` are verified to exist in `@earendil-works/pi-tui` (`dist/keys.d.ts`).

**Files:**
- Modify: `agent/extensions/daddy/panel/stream-view.ts`
- Modify: `agent/extensions/daddy/panel/component.ts`
- Test: `agent/extensions/daddy/panel/tests/stream-view.test.ts`
- Test: `agent/extensions/daddy/panel/tests/component.test.ts`

- [ ] **Step 1: Write the failing tests (stream-view)**

Add to `agent/extensions/daddy/panel/tests/stream-view.test.ts` inside the `describe`:

```typescript
  test("toLines returns the wrapped lines for entries", () => {
    const lines = toLines([entry("a"), entry("b")], 40);
    expect(lines).toEqual(["a", "b"]);
  });

  test("bottomOffset scrolls the window up into history", () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`line ${i}`));
    const scrolled = renderStreamView(entries, 40, 5, 3);
    // With 20 lines, height 5, offset 3 → window ends at line 16 (index 16 exclusive)
    expect(scrolled[4]).toContain("line 16");
    expect(scrolled.some((l) => l.includes("line 19"))).toBe(false);
  });

  test("bottomOffset is clamped so it never scrolls past the top", () => {
    const entries = Array.from({ length: 6 }, (_, i) => entry(`line ${i}`));
    const scrolled = renderStreamView(entries, 40, 3, 999);
    expect(scrolled[0]).toContain("line 0");   // top of content, not blank
  });
```

Update the import at the top of `stream-view.test.ts`:

```typescript
import { renderStreamView, toLines } from "../stream-view.ts";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: FAIL — `toLines` not exported; `renderStreamView` ignores a 4th arg.

- [ ] **Step 3: Implement (stream-view)**

In `agent/extensions/daddy/panel/stream-view.ts`, export `toLines` and rewrite `renderStreamView` to window with an offset:

```typescript
export function toLines(entries: StreamEntry[], width: number): string[] {
  const out: string[] = [];
  for (const e of entries) {
    for (const line of wordWrap(formatEntry(e), width)) out.push(line);
  }
  return out;
}

export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
  bottomOffset = 0,
): string[] {
  if (height <= 0) return [];
  const all = toLines(entries, width);
  const maxOffset = Math.max(0, all.length - height);
  const off = Math.min(Math.max(0, bottomOffset), maxOffset);
  const end = all.length - off;
  const start = Math.max(0, end - height);
  const win = all.slice(start, end);
  const padded = win.map((l) => pad(l, width));
  while (padded.length < height) padded.unshift(" ".repeat(width));
  return padded;
}
```

Delete the now-unused inline line-building loop from the old body (the `const allLines: string[] = []; for (const e of entries) ...` block is replaced by `toLines`).

- [ ] **Step 4: Run stream-view tests to verify they pass**

Run: `bun test agent/extensions/daddy/panel/tests/stream-view.test.ts`
Expected: PASS (all prior + 3 new; the `bottomOffset` default of 0 keeps every existing test green)

- [ ] **Step 5: Write the failing tests (component)**

Add to `agent/extensions/daddy/panel/tests/component.test.ts` inside the `describe`:

```typescript
  test("Page Up scrolls the stream up into history", () => {
    const { panel, store } = makePanel();
    for (let i = 0; i < 60; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    const before = panel.render(80);
    panel.handleInput("\x1b[5~"); // Page Up
    const after = panel.render(80);
    expect(after).not.toEqual(before);
  });

  test("node navigation resets the scroll offset", () => {
    const { panel, store } = makePanel();
    for (let i = 0; i < 60; i++) {
      store.appendStream("interview", { type: "text", content: `entry ${i}`, timestamp: i });
    }
    panel.handleInput("\x1b[5~");  // Page Up (scroll into history)
    panel.handleInput("\x1b[B");   // Down (navigate nodes) → resets offset
    panel.handleInput("\x1b[A");   // Up (back to interview)
    const lines = panel.render(80);
    // Offset reset → newest entry visible again
    expect(lines.some((l) => l.includes("entry 59"))).toBe(true);
  });
```

- [ ] **Step 6: Run component tests to verify they fail**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: FAIL — Page Up does nothing yet.

- [ ] **Step 7: Implement (component)**

In `agent/extensions/daddy/panel/component.ts`, import `toLines` and add scroll state.

Change the imports:

```typescript
import { renderStreamView, toLines } from "./stream-view.ts";
```

Add the field near `private selected = 0;`:

```typescript
  private scrollOffset = 0;
```

Update `handleInput` to handle paging and to reset the offset on node navigation:

```typescript
  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) { this.done(); return; }
    if (this.editor.isActive()) { this.editor.handleInput(data); return; }
    if (matchesKey(data, Key.pageUp)) { this.scrollOffset += 1; return; }
    if (matchesKey(data, Key.pageDown)) { this.scrollOffset = Math.max(0, this.scrollOffset - 1); return; }
    if (matchesKey(data, Key.up)) { this.selected = Math.max(0, this.selected - 1); this.scrollOffset = 0; }
    else if (matchesKey(data, Key.down)) {
      const max = this.getNodeEntries().length - 1;
      this.selected = Math.min(max, this.selected + 1);
      this.scrollOffset = 0;
    }
  }
```

In `render()`, clamp the offset against the wrapped line count and pass it through. Replace the line:

```typescript
    const right = renderStreamView(streams, rightWidth, streamHeight);
```

with:

```typescript
    const maxOffset = Math.max(0, toLines(streams, rightWidth).length - streamHeight);
    this.scrollOffset = Math.min(this.scrollOffset, maxOffset);
    const right = renderStreamView(streams, rightWidth, streamHeight, this.scrollOffset);
```

> Page Up/Down move by one line per press for deterministic, testable behavior; the offset is clamped each render so it can never scroll past the top.

- [ ] **Step 8: Run component tests to verify they pass**

Run: `bun test agent/extensions/daddy/panel/tests/component.test.ts`
Expected: PASS (all prior + 2 new)

- [ ] **Step 9: Typecheck**

Run: `bunx tsc --noEmit -p agent/extensions/daddy/tsconfig.json`
Expected: exit 0

- [ ] **Step 10: Commit**

```bash
git add agent/extensions/daddy/panel/stream-view.ts agent/extensions/daddy/panel/component.ts agent/extensions/daddy/panel/tests/stream-view.test.ts agent/extensions/daddy/panel/tests/component.test.ts
git commit -m "feat(daddy-panel): scroll stream view with Page Up/Down"
```

---

## Task 10: Integration test + full suite

**Files:**
- Create: `agent/extensions/daddy/panel/tests/wire-integration.test.ts`

- [ ] **Step 1: Write the end-to-end test (store + wrapDeps + component)**

This proves the previously-dead path: a paused run → `waitingForInput` set → editor active → the live text appears for the selected node.

```typescript
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

test("paused emission activates the editor with the prompt in the panel", () => {
  const store = createStore();
  const deps = wrapDeps(store, base);
  const panel = new DaddyPanel({ store, deps, done: () => {}, requestRender: () => {} });

  // Live progress before pause
  deps.progress!("interview", "Analyzing request...");
  // Node pauses for human input
  deps.emit(run({
    status: "paused", paused_node: "interview",
    nodes: { interview: { status: "paused", output: "What is your name?" } },
  }));

  const lines = panel.render(80);
  // The prompt is shown (editor placeholder) and the panel auto-navigated to it.
  expect(lines.some((l) => l.includes("What is your name?"))).toBe(true);
  expect(store.getState().waitingForInput).toBe("interview");
});

test("resuming clears the waiting state", () => {
  const store = createStore();
  const deps = wrapDeps(store, base);
  deps.emit(run({
    status: "paused", paused_node: "interview",
    nodes: { interview: { status: "paused", output: "Q?" } },
  }));
  expect(store.getState().waitingForInput).toBe("interview");
  // Engine resumes → running again
  deps.emit(run({ status: "running", nodes: { interview: { status: "completed", output: "done" } } }));
  expect(store.getState().waitingForInput).toBeNull();
});
```

- [ ] **Step 2: Run the integration test**

Run: `bun test agent/extensions/daddy/panel/tests/wire-integration.test.ts`
Expected: PASS (2/2)

- [ ] **Step 3: Run the full daddy suite (no regressions)**

Run: `bun test agent/extensions/daddy/ --no-coverage`
Expected: All tests PASS

- [ ] **Step 4: Typecheck the whole extension**

Run: `bunx tsc --noEmit -p agent/extensions/daddy/tsconfig.json`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/panel/tests/wire-integration.test.ts
git commit -m "test(daddy-panel): end-to-end pause→waiting→resume integration"
```

---

## Summary of Changes

| File | Action | Fixes |
|------|--------|-------|
| `panel/store.ts` | Modify | live state for real streaming (#5) |
| `panel/wire.ts` | Create | central bridge: `setWaiting` (#1), store on slash path (#3), live (#5) |
| `panel/node-list.ts` | Modify | color via `colorFor` (#6) |
| `panel/stream-view.ts` | Modify | zero-height guard (latent); scroll via `toLines`+offset (spec keybinding) |
| `panel/component.ts` | Modify | render live text (#5); drop `{} as any` (#8); Page Up/Down scroll (spec keybinding) |
| `panel/input-editor.ts` | Modify | drop unused `tui` (#8) |
| `lib/handle-command.ts` | Modify | drop dead `store?` param (#3 cleanup) |
| `index.ts` | Modify | open-before-run/live (#4), auto-open run (#2), pass wrapped deps to panel so editor-resume drives store (#7), observer hydration, single-panel guard |
| `panel/tests/*` + `index.test.ts` | Modify/Create | unit + integration coverage |

---

## Design Decisions

1. **Single bridge (`wrapDeps`)** — the prior code duplicated store wiring in `index.ts` and `handle-command.ts` and still missed `setWaiting`. One function, used by the tool path, the slash `run` path, observer, and resume-from-editor. DRY.
2. **Waiting derived from `RunState`, not a separate signal** — `approval.ts` already returns the prompt as the paused node's `output`, and `dag-executor` sets `state.paused_node`. Deriving `waitingForInput` inside `wrapDeps.emit` means ANY pause (current or future) lights up the editor with zero extra wiring in node code.
3. **Open before run** — `ctx.ui.custom` builds the component synchronously and renders from store subscriptions; not awaiting its close promise lets the run proceed while the panel updates live. This is the same observer pattern the subagent panel uses.
4. **Wrapped deps passed to the panel** — so `resumeRun` triggered by the editor (`component.submitInput`) drives the same store and clears `waitingForInput` when the run leaves the paused state. Without this the panel froze after the first submit.
5. **Live text replaces, history appends** — `progress` is cumulative (verified in `runner.ts:31`, throttled 150ms), so it REPLACES `live[nodeId]`; on completion `onStream` appends the final output to permanent history and clears live. Loop iteration ids (`build #2`) are mapped to their base id for attribution.
6. **Color via truecolor ANSI after padding** — matches the subagent panel's `palette.ts` approach; ANSI is zero-width so column math stays on plain text.
7. **Observer hydration is best-effort** — node statuses and the paused prompt are restored from the persisted run; streams are in-memory only and not recoverable across sessions (documented limitation, out of scope to persist).

---

## Out of Scope (and why)

One spec display detail is intentionally NOT covered, because closing it requires data the panel does not currently receive:

- **"For pending nodes: shows `Waiting for dependencies: [dep1, dep2]`"** (spec, Right Column). `RunState.nodes` carries per-node status/output but NOT the workflow's dependency edges (those live in `WorkflowDef`, never threaded into the store/panel). Implementing this hint would require passing the `WorkflowDef` (or a derived adjacency map) into the store — a larger change beyond the review findings. Pending nodes currently render a blank stream. **Recommend** as a separate follow-up if desired.

Everything else in the spec (layout, node tree + colored icons, arrow navigation, live streaming, inline editor activation on pause, auto-navigation, Escape close, `/daddy observer` re-open with hydration, Page Up/Down scroll, completed-node captured output) is covered by Tasks 1–10.
```