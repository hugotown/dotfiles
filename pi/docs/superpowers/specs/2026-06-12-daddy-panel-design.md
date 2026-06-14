# daddy panel — Design Specification

**Date:** 2026-06-12
**Status:** Approved
**Type:** New feature within daddy extension
**Depends on:** 2026-06-12-daddy-design.md (core engine)

## Summary

A TUI overlay panel for live workflow observation and bidirectional interaction. Opens automatically when a workflow starts, shows node tree on the left, streaming output on the right, and an inline editor for interactive input when a node requires user attention. Replaces the previous `pi.on("input")` interception mechanism entirely.

## Decisions

| Decision | Choice |
|----------|--------|
| Panel trigger | Auto-open on `/daddy flow=X` start |
| Re-open mechanism | `/daddy observer` command |
| Close mechanism | Escape key (workflow continues in background) |
| Panel lifetime | Stays open after workflow completes; user closes manually |
| Input model | Inline chat editor within the panel (not modal, not main editor) |
| Auto-navigation | When a node needs input, `selectedNode` auto-switches to that node; also auto-switches to the first `running` node while the user has not manually navigated |
| Input interception from main LLM | All interaction lives inside the panel |
| Panel title | *Deterministic, Agentic-Driven Development — You Lead.* |
| Architecture pattern | Inspired by the subagent panel and the ask-user-question-tool editor; independently implemented (no shared code) |
| Node icons | ASCII/Latin-1 glyphs (portable across monospace fonts); color carries the visual signal |
| Stream persistence | Sidecar file `<home>/runs/<id>.streams.json` (throttled 500ms) so `observer` between sessions can replay history |

## Removed: `pi.on("input")` Hook (no-op)

> **Note (2026-06-13):** the original draft of this spec called for removing the `pi.on("input")` handler from `index.ts`, but the committed `index.ts` never had such a handler — `startRun` blocks on `await executeDag(...)` so no `pi.on("input")` interception was ever needed. The removal action is a no-op. This section is retained for traceability; no source change is required.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Deterministic, Agentic-Driven Development — You Lead.              │
├──────────────┬──────────────────────────────────────────────────────┤
│ Nodes        │  Stream (scrollable, with ↓ more / ↑ top markers)   │
│              │                                                       │
│ > + intervie │  [LLM]: Analyzing your request...                    │
│   ~ summary  │  [LLM]: What is your name?                           │
│              │  ...                                                  │
│              │                                                       │
│              │  [shows ONLY when the selected node is waiting: ]    │
│              │  ──────────────────────────────────────────────────  │
│              │  > _                              [Enter to send]     │
└──────────────┴──────────────────────────────────────────────────────┘
```

> **Note (2026-06-13):** the editor block at the bottom is **conditional**: it only renders when the selected node is in `waiting_for_input` state. The ASCII art shows both states for documentation; the empty state renders a blank row instead of the divider + editor.

### Left Column — Node Tree

- Lists all nodes from the workflow definition in DAG order
- Each node shows an icon reflecting its current state (ASCII/Latin-1 glyphs for font portability; color from `palette.ts`):
  - `·` pending (not started)
  - `>` running (actively executing)
  - `?` waiting for input (interactive pause)
  - `+` completed
  - `!` failed
  - `~` skipped
  - `x` cancelled
- Arrow keys (Up/Down) navigate the selected node
- Selected node is highlighted; selecting a node manually disables auto-navigation
- Auto-navigation: panel auto-selects the waiting node; while the user has not navigated, also auto-selects the first running node

### Right Column — Stream View

- Shows the streaming output of the currently selected node
- Scrollable with Page Up / Page Down (one line per press)
- Content includes: LLM text output, tool calls, status transitions
- For pending nodes: shows "Waiting for dependencies: [dep1, dep2]" (TODO; requires `WorkflowDef` in store)
- For completed nodes: shows the captured output (read-only history)
- A `↓ more` marker appears on the last visible line when more history is hidden below the viewport
- A `↑ top` marker appears on the first visible line when the user has scrolled up

### Bottom Section — Inline Editor

- Only visible when the selected node is in `waiting_for_input` state
- Standalone `InlineEditor` class in `panel/input-editor.ts` (not the TUI's `Editor` widget)
- Placeholder text shows the question/prompt from the node
- Enter submits the input → calls `resumeRun()` (via wrapped deps) → editor disappears → node continues
- The editor is single-line; backspace removes the last character

## Behavior

### 1. Workflow Start → Panel Opens

```
User: /daddy flow=interview-test
  → startRun() initiates the workflow
  → Panel opens immediately via ctx.ui.custom()
  → Node tree populates from workflow definition
  → First executable node starts running, stream appears on right
```

### 2. Node Needs Input → Auto-Navigate

```
Node "interview" reaches interactive pause:
  → Node icon changes to ◉
  → selectedNode auto-switches to "interview" (even if user was browsing another node)
  → Stream shows the question/context
  → Editor appears at bottom with cursor ready
```

### 3. User Provides Input

```
User types "hugo" + Enter in the inline editor:
  → Editor content captured
  → resumeRun(runId, deps, { decision: "approve", comment: "hugo" })
  → Editor disappears
  → Node resumes execution, stream continues
```

### 4. User Closes Panel (Escape)

```
User presses Escape:
  → Panel closes (overlay dismissed)
  → Workflow continues running in background
  → User returns to main pi editor
  → Can re-open with /daddy observer
```

### 5. Re-Open Panel

```
User: /daddy observer
  → Finds active/paused run
  → Opens panel with current state
  → If a node is waiting for input, auto-navigates there
```

### 6. Workflow Completes

```
All nodes finish:
  → Panel stays open showing final state
  → All nodes show ✓ or ✗
  → No editor visible (nothing waiting)
  → User reviews results, closes with Escape when done
```

## Reactive Store

A pub/sub in-memory store (same pattern as subagent extension) that bridges the run-controller and the panel:

```typescript
interface DaddyPanelStore {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;  // nodeId → stream lines
  waitingForInput: string | null;          // nodeId that needs user input
  inputPrompt: string | null;              // question text to show as placeholder
}

interface StreamEntry {
  type: "text" | "tool_call" | "status";
  content: string;
  timestamp: number;
}
```

### Store Updates

- `run-controller` emits state changes → store updates `run`
- Node executor streams output → store appends to `streams[nodeId]`
- Interactive pause → store sets `waitingForInput` + `inputPrompt`
- Panel subscribes → re-renders on every store change

## File Structure (new files)

```
agent/extensions/daddy/
  panel/
    store.ts              Reactive store (state + pub/sub)
    open.ts               Opens the panel via ctx.ui.custom()
    component.ts          Main DaddyPanel Component (layout orchestrator)
    node-list.ts          Left column: node tree renderer
    stream-view.ts        Right column: streaming output
    input-editor.ts       Bottom: Editor widget wrapper
    icons.ts              Node state → icon mapping
```

## Keybindings (inside panel)

| Key | Action |
|-----|--------|
| Up/Down | Navigate node list |
| Escape | Close panel |
| Enter | Submit input (when editor is active) |
| Page Up/Down | Scroll stream view |

## Changes to Existing Code

### `index.ts`

1. **Add** panel opening after `createStore()` in the command handler (BEFORE awaiting the run, so observation is live)
2. **Add** `/daddy observer` subcommand that opens the panel for an existing run; on first observer in a session, hydrate from disk (RunState + streams sidecar)
3. **Add** a stream-persistence subscription that mirrors `store.getState().streams` to `<home>/runs/<id>.streams.json` (throttled 500ms)
4. **Keep** `pi.on("session_start")` notification (useful hint that a run is paused)

### `lib/command-router.ts`

- Add `observer` as a valid command kind

### `lib/handle-command.ts`

- Add handler for `observer` that opens the panel

### `lib/run-controller.ts`

- Emit events to the reactive store during execution (stream output, state changes)
- The store instance is created in `open.ts` and passed into both the panel component and the run-controller via the `deps` object. One store per run, no singletons.

## Overlay Options

```typescript
ctx.ui.custom<void>(
  (tui, theme, _kb, done) => new DaddyPanel({ theme, done, store, deps }),
  {
    overlay: true,
    overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" },
  },
);
```

## Out of Scope

- Custom theming beyond what pi's Theme provides
- Multiple simultaneous workflow panels
- Panel keyboard shortcut (double-press) — uses explicit `/daddy observer` only
- Split-pane resizing
- Mouse support
