# daddy — Deterministic Agentic Workflow Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone pi.dev extension at `~/.config/pi/agent/extensions/daddy/` that authors VSM→SIPOC→node workflows in YAML and executes them as a dependency graph where the extension orchestrates and the LLM only creates — so deterministic steps cost zero tokens and each LLM node receives only the upstream context it references.

**Architecture:** A flag (`--daddy-workflow <name>`) intercepted in `pi.on("input")` (the `hello` pattern) kicks off a re-entrant wave driver (`continueRun`). Self-contained nodes (`bash`, `flag`, `llm`, `ask` with `aiAssisted:false`) are awaited in parallel within a wave (bounded by a semaphore copied from `subagent`); the AI-assisted `ask` node delegates to the main agent and suspends, resuming on `pi.on("agent_end")` (the `dev-pipeline` pattern). `llm` nodes spawn an isolated child `pi` (`DADDY_NODE=1`) that registers only an `append_node` tool whose validation loop forces structured output. State persists as an atomic JSON file keyed by workflow name under `ctx.sessionManager.getSessionDir()` so resume survives a restart. A double-press-`←` TUI panel both designs (writes YAML) and observes runs (reads the state machine).

**Tech Stack:** TypeScript + Bun, `@earendil-works/pi-coding-agent@0.75.4`, `@earendil-works/pi-tui@0.75.4`, `typebox@1.1.38`, `yaml@2.9.0`. Tests via `bun test`.

---

## Verified API surface (grounded in source — do not re-guess)

Every API below was confirmed by reading the pi SDK type sources and the sibling extensions during planning. File:line references are for the engineer to re-read patterns, not to copy unverified.

| API | Shape | Source |
|---|---|---|
| `pi.registerFlag(name, { description, type })` | `type: "boolean" \| "string"` | `hello/index.ts:12` |
| `pi.on("input", async (event, ctx) => …)` | `event.text: string`, `event.source: string`; return `{ action: "continue" \| "handled" }` or `{ action: "transform", text }` | `hello/index.ts:22`, `dev-pipeline/index.ts:50` |
| **input loop guard** | `if (event.source === "extension") return { action: "continue" }` | `dev-pipeline/index.ts:51` |
| `pi.sendMessage({ customType, content, display }, { triggerTurn })` | `display: boolean`; opts `{ triggerTurn?: boolean }` | `hello/index.ts:36`, `dev-pipeline/orchestrator.ts:64` |
| `pi.sendUserMessage(content, options?)` | triggers a turn | `dev-pipeline/orchestrator.ts:65` |
| `pi.on("agent_end", async (event, ctx) => …)` | `event.messages: AgentMessage[]` | `dev-pipeline/index.ts:86` |
| `pi.on("context", async (event) => …)` | return `{ messages }` to replace window | `dev-pipeline/index.ts:80` |
| `pi.setModel(model): Promise<boolean>` | false if no API key | `dev-pipeline/orchestrator.ts:34` |
| `pi.setActiveTools(names: string[]): void` | — | `dev-pipeline/orchestrator.ts:39` |
| `pi.getAllTools(): { name }[]` | — | `dev-pipeline/orchestrator.ts:45` |
| `pi.registerTool({ name, label, description, parameters, execute, renderResult })` | `execute(id, params, signal, onUpdate, ctx)` returns `{ content, details?, terminate? }` | `subagent/index.ts:25`, SDK `examples/extensions/structured-output.ts` |
| **tool `{ terminate: true }`** | ends the child turn on the tool call | SDK `examples/extensions/structured-output.ts:42` |
| **throw inside `execute()`** | becomes an `isError` tool result fed back to the model, which retries | design §8 (verified against pi agent loop) |
| `pi.events.emit("flag:registered", { token, description })` (on `session_start`) | autocomplete bus | `hello/index.ts:19`, `gemini/lib/flag.ts:30` |
| `ctx.cwd: string` | working dir | `dev-pipeline/index.ts:213` |
| `ctx.hasUI: boolean` | false in print/RPC mode | SDK `ExtensionContext` |
| `ctx.sessionManager` | `ReadonlySessionManager` = `Pick<…, "getCwd" \| "getSessionDir" \| "getSessionId" \| "getBranch" \| "getEntries" \| …>` | SDK `ExtensionContext`; `dev-pipeline/orchestrator.ts:15` uses `getBranch()` |
| `ctx.sessionManager.getSessionDir(): string` | the per-cwd session directory | SDK `SessionManager` |
| `ctx.modelRegistry.find(provider, id)` | `Model \| undefined` | `dev-pipeline/orchestrator.ts:29` |
| `ctx.model` | `{ provider, id } \| undefined` | `dev-pipeline/orchestrator.ts:46` |
| `ctx.ui.notify(msg, level)` | `level: "info"\|"warning"\|"error"` | `gemini/lib/flag.ts` |
| `ctx.ui.input(label, default): Promise<string>` | inline prompt | `gemini/document-processing/flag.ts` |
| `ctx.ui.custom<T>(renderFn, { overlay, overlayOptions })` | overlay panel | `subagent/panel/open.ts:11` |
| `ctx.ui.onTerminalInput(cb)` | `cb(data) => undefined \| { consume: true }` | `subagent/panel/trigger.ts:23` |
| `matchesKey(data, keyId)`, `type KeyId` | from `@earendil-works/pi-tui` | `subagent/panel/trigger.ts:7` |
| spawn pattern | `getPiInvocation(args)` + `spawn(command, args, { cwd, shell:false, stdio:["ignore","pipe","pipe"] })`; parse stdout lines for `event.type==="message_end" && message.role==="assistant"` (and `role==="custom"` for `customType`) | `hello/subagent.ts:14,49,82` |
| child pi args | `["--mode","json","-p","--no-session","--thinking",<variant>,"--append-system-prompt",<instr>, <userMsg>]` | `hello/subagent.ts:51` |

**Module export shape:** `export default function daddy(pi: ExtensionAPI): void { … }` — `pi` is the only init arg; `ctx` arrives in event handlers. (`hello/index.ts:10`.)

**Persistence divergence (intentional):** `dev-pipeline` persists with `pi.appendEntry` (session-scoped). daddy MUST NOT copy that — its requirement is resume-across-restart keyed by **workflow name**, so it writes a standalone JSON file (`<workflow>.daddy.json`) inside `getSessionDir()`. This is a deliberate, design-mandated difference (design §12.1).

---

## File structure (single responsibility; target ≤70 LOC, hard cap 120 with justification)

```
daddy/
  package.json            # pi extension manifest + deps
  tsconfig.json           # bun/ESNext config
  config.yml              # keymap + Tokyo Night theme
  index.ts                # default export: register flags, install handlers, DADDY_NODE branch  (~95 LOC*)
  constants.ts            # env name, limits, custom-message types, dir/file names
  types.ts                # Action, Status, Variant, WorkflowNode, Workflow, NodeState, StateMachine
  schema.ts               # TypeBox: workflow definition + append_node parameters
  lib/
    load-workflow.ts      # resolve <name> → read + parse + normalize YAML
    validate.ts           # graph + ref + per-action field validation (§11)   (~110 LOC*)
    resolve-refs.ts       # substitute $node.output / $ARGUMENTS; collectRefs
    driver.ts             # partitionReady (pure) + continueRun (re-entrant wave driver)  (~100 LOC*)
    run-node.ts           # dispatch self-contained nodes by action
    run-bash-node.ts      # exec exact command
    run-flag-node.ts      # spawn headless `pi <flag> <args>` --no-session + capture
    run-llm-node.ts       # spawn isolated child (DADDY_NODE=1) + append_node capture
    run-ask-node.ts       # authored questions form (engine UI, awaitable)
    delegate-ask.ts       # AI-ask: capture/restore model+tools, marker + sendUserMessage
    append-tool.ts        # the append_node tool (child only); validation + retry cap
    state-store.ts        # build / merge / atomic-persist (tmp+rename) / load / resume  (~95 LOC*)
    schema-compile.ts     # compile a node's output_schema JSON to a TypeBox validator
    semaphore.ts          # bounded concurrency (verbatim copy of subagent's)
    session-path.ts       # state file path from getSessionDir() + workflow name
    json-stream.ts        # fold `pi --mode json` stdout → last assistant text / custom message
    spawn-pi.ts           # getPiInvocation + run a child pi, return parsed stream  (shared by flag+llm)
    flat-nodes.ts         # allNodes(state), findNode(state, id) helpers
    double-press.ts       # DoublePressDetector (verbatim copy of subagent's)
    gate.ts               # editorIsEmpty(ctx) + hasActiveRun() gate for the trigger
    store.ts              # in-memory run snapshot + subscribe (panel live view)
  panel/
    trigger.ts            # raw-input double-press watcher → openPanel
    open.ts               # ctx.ui.custom overlay; subscribe to store
    view.ts               # DaddyPanel Component: master-detail, mode switch
    layout.ts             # column join + status markers + theme helpers
    run-render.ts         # render run-mode (live status tree + active log)
    design-render.ts      # render design-mode (tree + detail form)
    editor.ts             # PURE tree ops: add/connect/delete VSM/SIPOC/node; serialize to YAML
  tests/
    validate.test.ts  resolve-refs.test.ts  driver.test.ts  state-store.test.ts
    load-workflow.test.ts  append-tool.test.ts  editor.test.ts  schema-compile.test.ts
```

`*` Files marked exceed 70 LOC. Justification carried per file: `index.ts` wires four event handlers + the child branch (splitting them would scatter one cohesive registration surface); `validate.ts` enforces seven distinct rule families each a few lines (already a flat list, no shared abstraction to extract); `driver.ts` holds the re-entrant loop whose halves (pure `partitionReady` + impure `continueRun`) must stay adjacent to be readable; `state-store.ts` groups the five state lifecycle operations that change together. All stay under the 120 hard cap.

---

# Milestone A — Scaffold, types, schema (no behavior yet)

### Task 1: Scaffold the extension package

**Files:**
- Create: `agent/extensions/daddy/package.json`
- Create: `agent/extensions/daddy/tsconfig.json`
- Create: `agent/extensions/daddy/config.yml`

- [ ] **Step 1: Write `package.json`** (mirrors `subagent/package.json`, adds `yaml`)

```json
{
	"name": "pi-daddy",
	"private": true,
	"version": "0.1.0",
	"type": "module",
	"pi": {
		"extensions": ["./index.ts"]
	},
	"scripts": {
		"test": "bun test",
		"typecheck": "tsc --noEmit"
	},
	"dependencies": {
		"@earendil-works/pi-coding-agent": "0.75.4",
		"@earendil-works/pi-tui": "0.75.4",
		"typebox": "1.1.38",
		"yaml": "2.9.0"
	},
	"devDependencies": {
		"@types/bun": "^1.3.14",
		"@types/node": "^22.0.0",
		"typescript": "^5.6.0"
	}
}
```

- [ ] **Step 2: Write `tsconfig.json`** (verbatim from `subagent/tsconfig.json`)

```json
{
	"compilerOptions": {
		"target": "ESNext",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"strict": true,
		"skipLibCheck": true,
		"noEmit": true,
		"allowImportingTsExtensions": true,
		"esModuleInterop": true,
		"verbatimModuleSyntax": true,
		"lib": ["ESNext", "DOM"],
		"types": ["node", "bun"]
	},
	"include": ["**/*.ts"],
	"exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `config.yml`** (keymap + theme, mirrors `subagent/config.yml`)

```yaml
# daddy panel config. Edit and restart pi to apply.
keymap:
  # Double-press this key (when the editor is EMPTY) to open the panel.
  trigger:
    key: left
    windowMs: 300
  nav:
    up: [up, k]
    down: [down, j]
    left: [left, h]
    right: [right, l]
    enter: [enter]
    add: [a]
    delete: [d, x]
    connect: [c]
    inject: [i]   # insert $dep.output into an llm node's prompt
    save: [s]
    mode: [tab]   # switch design <-> run
    close: [escape, q]
# theme: omit to use Tokyo Night defaults (see lib for the palette).
```

- [ ] **Step 4: Install dependencies**

Run: `cd agent/extensions/daddy && bun install`
Expected: creates `bun.lock` and `node_modules/` with no errors.

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/package.json agent/extensions/daddy/tsconfig.json agent/extensions/daddy/config.yml agent/extensions/daddy/bun.lock
git commit -m "feat(daddy): scaffold extension package"
```

---

### Task 2: Shared types

**Files:**
- Create: `agent/extensions/daddy/types.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
// SDK-free shared types so validation/scheduling can be unit-tested in isolation.

export type Action = "bash" | "flag" | "ask" | "llm";
export type Status = "pending" | "running" | "ok" | "failed" | "skipped";
export type Variant = "low" | "medium" | "high";

/** One authored question for a deterministic (aiAssisted:false) ask node. */
export interface AskQuestion {
	id: string;
	type: "select" | "text";
	label: string;
	options?: string[];
	default?: string;
	reasoning?: string;
}

/** A node as authored in YAML (design-time). depends_on is normalized to [] on load. */
export interface WorkflowNode {
	id: string;
	action: Action;
	aiAssisted: boolean;
	depends_on: string[];
	command?: string; // bash
	flag?: string; // flag
	args?: string; // flag
	questions?: AskQuestion[]; // ask, aiAssisted:false
	prompt?: string; // ask aiAssisted:true | llm
	provider?: string; // llm
	model?: string; // llm
	variant?: Variant; // llm
	instructions?: string; // llm
	provides?: string; // documentation only (design §17.1)
	output_schema?: Record<string, unknown>; // llm optional
}

export interface SipocChain {
	sipoc: string;
	supplier?: string;
	customer?: string;
	nodes: WorkflowNode[];
}

export interface Workflow {
	name: string;
	description?: string;
	vsm: SipocChain[];
}

/** Runtime node = authored node + execution status/output. */
export interface NodeState extends WorkflowNode {
	status: Status;
	output?: string;
	structured?: unknown;
	startedAt?: string;
	endedAt?: string;
}

export interface SipocState {
	sipoc: string;
	nodes: NodeState[];
}

export interface StateMachine {
	workflow: string;
	arguments: string;
	startedAt: string;
	pid: number;
	heartbeat: string;
	vsm: SipocState[];
}

/** Uniform return of a self-contained node executor. */
export interface NodeResult {
	status: "ok" | "failed";
	output: string;
	structured?: unknown;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add agent/extensions/daddy/types.ts
git commit -m "feat(daddy): add shared types"
```

---

### Task 3: Constants

**Files:**
- Create: `agent/extensions/daddy/constants.ts`

- [ ] **Step 1: Write `constants.ts`**

```typescript
// Centralized magic values so handlers/executors stay DRY.

/** Set in the child pi spawned for an llm node; flips index.ts into child mode. */
export const DADDY_NODE_ENV = "DADDY_NODE";

/** Main execution flag and its namespaced modifiers (design §12.3). */
export const FLAG_WORKFLOW = "--daddy-workflow";
export const FLAG_FRESH = "--daddy-fresh";
export const FLAG_DESIGN = "--daddy-design";

/** Max parallel self-contained nodes within a wave. */
export const WAVE_CONCURRENCY = 4;

/** Cap append_node retries so an unsatisfiable output_schema fails the node (design §8). */
export const MAX_APPEND_ATTEMPTS = 5;

/** Custom message the child emits with the validated node result (display:false). */
export const NODE_RESULT_TYPE = "daddy-node-result";

/** Hidden marker injected before an AI-ask delegation; the context filter trims to it. */
export const ASK_MARKER = "daddy-ask-marker";

/** Workflow YAML lives here, project-local (design §3 non-goals). */
export const WORKFLOW_DIR = ".pi/daddy/workflows";

/** State file suffix; the file is named <workflow>.daddy.json. */
export const STATE_SUFFIX = ".daddy.json";
```

- [ ] **Step 2: Commit**

```bash
git add agent/extensions/daddy/constants.ts
git commit -m "feat(daddy): add constants"
```

---

### Task 4: TypeBox schemas (workflow definition + append_node parameters)

**Files:**
- Create: `agent/extensions/daddy/schema.ts`

- [ ] **Step 1: Write `schema.ts`** (the append_node param schema is the only schema the child registers; the workflow schema documents the YAML contract)

```typescript
// TypeBox schemas. AppendNodeParams is the child-only tool's parameter contract;
// validation of `structured` against a node's output_schema happens in append-tool.ts.
import { Type } from "typebox";

export const AppendNodeParams = Type.Object({
	node_id: Type.String({
		description: "The id of the node you are producing output for. Must equal the node being executed.",
	}),
	status: Type.Union([Type.Literal("ok"), Type.Literal("failed")], {
		description: "'ok' if you produced the required output, 'failed' if the task cannot be completed.",
	}),
	output: Type.String({
		description: "The produced result as text. Downstream nodes that reference $<this node>.output read exactly this.",
	}),
	structured: Type.Optional(
		Type.Unknown({
			description: "REQUIRED only if this node declared an output_schema. The structured object matching that schema.",
		}),
	),
});

export type AppendNodeArgs = {
	node_id: string;
	status: "ok" | "failed";
	output: string;
	structured?: unknown;
};
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add agent/extensions/daddy/schema.ts
git commit -m "feat(daddy): add append_node TypeBox schema"
```

---

# Milestone B — Pure logic (strict TDD, no SDK)

### Task 5: Semaphore (verbatim copy)

**Files:**
- Create: `agent/extensions/daddy/lib/semaphore.ts`

- [ ] **Step 1: Write `lib/semaphore.ts`** (verbatim from `subagent/lib/semaphore.ts` — intentional copy, no import, per design §3 non-goals)

```typescript
// A minimal counting semaphore for bounding concurrent node runs.
// Intentional copy of subagent's; daddy is standalone (design §3).

export interface Semaphore {
	acquire(): Promise<void>;
	release(): void;
}

export function createSemaphore(limit: number): Semaphore {
	let active = 0;
	const waiters: Array<() => void> = [];
	return {
		acquire(): Promise<void> {
			if (active < limit) {
				active++;
				return Promise.resolve();
			}
			return new Promise<void>((resolve) => waiters.push(resolve)).then(() => {
				active++;
			});
		},
		release(): void {
			active--;
			waiters.shift()?.();
		},
	};
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/extensions/daddy/lib/semaphore.ts
git commit -m "feat(daddy): add semaphore (copied from subagent)"
```

---

### Task 6: Flat-node helpers

**Files:**
- Create: `agent/extensions/daddy/lib/flat-nodes.ts`

- [ ] **Step 1: Write `lib/flat-nodes.ts`**

```typescript
// The driver, validator and resolver operate on the flat node list; the VSM>SIPOC
// containment is only for the map. These helpers flatten/index a StateMachine.
import type { NodeState, StateMachine } from "../types.ts";

export function allNodes(state: StateMachine): NodeState[] {
	return state.vsm.flatMap((chain) => chain.nodes);
}

export function findNode(state: StateMachine, id: string): NodeState | undefined {
	return allNodes(state).find((n) => n.id === id);
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/flat-nodes.ts
git commit -m "feat(daddy): add flat-node helpers"
```

---

### Task 7: resolve-refs (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/resolve-refs.ts`
- Test: `agent/extensions/daddy/tests/resolve-refs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import type { StateMachine } from "../types.ts";
import { collectRefs, resolveRefs } from "../lib/resolve-refs.ts";

const state: StateMachine = {
	workflow: "w", arguments: "build the thing", startedAt: "", pid: 1, heartbeat: "",
	vsm: [{ sipoc: "s", nodes: [
		{ id: "scope", action: "ask", aiAssisted: true, depends_on: [], status: "ok", output: "auth only" },
	] }],
};

describe("collectRefs", () => {
	it("finds $node.output references", () => {
		expect(collectRefs("CONTEXT: $scope.output and $other.output")).toEqual(["scope", "other"]);
	});
	it("ignores $ARGUMENTS", () => {
		expect(collectRefs("see $ARGUMENTS")).toEqual([]);
	});
});

describe("resolveRefs", () => {
	it("substitutes a known node output", () => {
		expect(resolveRefs("CTX: $scope.output", state, "")).toBe("CTX: auth only");
	});
	it("substitutes $ARGUMENTS", () => {
		expect(resolveRefs("task: $ARGUMENTS", state, "build the thing")).toBe("task: build the thing");
	});
	it("throws on an unknown node ref", () => {
		expect(() => resolveRefs("$ghost.output", state, "")).toThrow("unknown reference: $ghost.output");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/resolve-refs.test.ts`
Expected: FAIL (module `../lib/resolve-refs.ts` not found).

- [ ] **Step 3: Write `lib/resolve-refs.ts`**

```typescript
// Substitute $node.output and $ARGUMENTS into a node's prompt/context. This is the
// context-economy mechanism: a node sees only the upstream outputs it names (design §7).
import { findNode } from "./flat-nodes.ts";
import type { StateMachine } from "../types.ts";

const REF = /\$([A-Za-z][\w-]*)\.output/g;

/** All distinct node ids referenced via $id.output (excludes $ARGUMENTS). */
export function collectRefs(text: string): string[] {
	const ids: string[] = [];
	for (const m of text.matchAll(REF)) if (!ids.includes(m[1])) ids.push(m[1]);
	return ids;
}

/** Replace $ARGUMENTS and every $id.output with persisted text. Throws on unknown ids. */
export function resolveRefs(text: string, state: StateMachine, args: string): string {
	const withArgs = text.split("$ARGUMENTS").join(args);
	return withArgs.replace(REF, (_full, id: string) => {
		const node = findNode(state, id);
		if (!node) throw new Error(`unknown reference: $${id}.output`);
		return node.output ?? "";
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/resolve-refs.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/resolve-refs.ts agent/extensions/daddy/tests/resolve-refs.test.ts
git commit -m "feat(daddy): add ref resolver with tests"
```

---

### Task 8: validate (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/validate.ts`
- Test: `agent/extensions/daddy/tests/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import type { Workflow } from "../types.ts";
import { validateWorkflow } from "../lib/validate.ts";

function wf(nodes: Workflow["vsm"][number]["nodes"], name = "auth"): Workflow {
	return { name, vsm: [{ sipoc: "s", nodes }] };
}

describe("validateWorkflow", () => {
	it("accepts a sound workflow", () => {
		expect(
			validateWorkflow(
				wf([
					{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "bun test" },
					{ id: "b", action: "llm", aiAssisted: true, depends_on: ["a"], provider: "x", model: "y", variant: "low", prompt: "go $a.output" },
				]),
			),
		).toBeNull();
	});

	it("rejects a duplicate id", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "y" },
		]));
		expect(e?.kind).toBe("duplicate");
	});

	it("rejects a cycle", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: ["b"], command: "x" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" },
		]));
		expect(e?.kind).toBe("cycle");
	});

	it("rejects an unknown dependency", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: ["ghost"], command: "x" }]));
		expect(e?.kind).toBe("unknown-dependency");
	});

	it("rejects a $ref to a non-ancestor node", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
			{ id: "b", action: "llm", aiAssisted: true, depends_on: [], provider: "x", model: "y", variant: "low", prompt: "$a.output" },
		]));
		expect(e?.kind).toBe("unknown-ref");
	});

	it("rejects a missing per-action field (bash without command)", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: [] }]));
		expect(e?.kind).toBe("missing-field");
	});

	it("rejects bad aiAssisted (llm must be true)", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "llm", aiAssisted: false, depends_on: [], provider: "x", model: "y", variant: "low", prompt: "p" }]));
		expect(e?.kind).toBe("bad-ai-assisted");
	});

	it("rejects a multi-token workflow name", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" }], "auth feature"));
		expect(e?.kind).toBe("bad-name");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/validate.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/validate.ts`** (≈110 LOC — justification: seven independent rule families, design §11; no shared abstraction to factor)

```typescript
// Static validation before any node runs (design §11). Returns the FIRST error or null.
import { collectRefs } from "./resolve-refs.ts";
import type { Action, Workflow, WorkflowNode } from "../types.ts";

export type ValidationError =
	| { kind: "bad-name"; name: string }
	| { kind: "duplicate"; id: string }
	| { kind: "self-dependency"; id: string }
	| { kind: "unknown-dependency"; node: string; dependency: string }
	| { kind: "cycle"; path: string[] }
	| { kind: "unknown-ref"; node: string; ref: string }
	| { kind: "missing-field"; node: string; field: string }
	| { kind: "bad-ai-assisted"; node: string };

const FLAT = (wf: Workflow): WorkflowNode[] => wf.vsm.flatMap((c) => c.nodes);

const REQUIRED: Record<Action, (n: WorkflowNode) => string | null> = {
	bash: (n) => (n.command ? null : "command"),
	flag: (n) => (n.flag ? null : "flag"),
	llm: (n) => (n.provider && n.model && n.variant && n.prompt ? null : "provider/model/variant/prompt"),
	ask: (n) => (n.aiAssisted ? (n.prompt ? null : "prompt") : n.questions?.length ? null : "questions"),
};

const AI_OK: Record<Action, (ai: boolean) => boolean> = {
	bash: (ai) => ai === false,
	flag: (ai) => ai === false,
	llm: (ai) => ai === true,
	ask: () => true,
};

/** Ancestors reachable via depends_on (transitive). */
function ancestors(id: string, byId: Map<string, WorkflowNode>): Set<string> {
	const seen = new Set<string>();
	const stack = [...(byId.get(id)?.depends_on ?? [])];
	while (stack.length) {
		const cur = stack.pop()!;
		if (seen.has(cur)) continue;
		seen.add(cur);
		stack.push(...(byId.get(cur)?.depends_on ?? []));
	}
	return seen;
}

function findCycle(nodes: WorkflowNode[], byId: Map<string, WorkflowNode>): string[] | null {
	const state = new Map<string, 0 | 1 | 2>(); // 0 visiting, 2 done
	const path: string[] = [];
	const visit = (id: string): string[] | null => {
		if (state.get(id) === 2) return null;
		if (state.get(id) === 0) return [...path, id];
		state.set(id, 0);
		path.push(id);
		for (const dep of byId.get(id)?.depends_on ?? []) {
			const c = visit(dep);
			if (c) return c;
		}
		path.pop();
		state.set(id, 2);
		return null;
	};
	for (const n of nodes) {
		const c = visit(n.id);
		if (c) return c;
	}
	return null;
}

export function validateWorkflow(wf: Workflow): ValidationError | null {
	if (!/^\S+$/.test(wf.name)) return { kind: "bad-name", name: wf.name };
	const nodes = FLAT(wf);
	const byId = new Map<string, WorkflowNode>();
	for (const n of nodes) {
		if (byId.has(n.id)) return { kind: "duplicate", id: n.id };
		byId.set(n.id, n);
	}
	for (const n of nodes) {
		if (!AI_OK[n.action](n.aiAssisted)) return { kind: "bad-ai-assisted", node: n.id };
		const missing = REQUIRED[n.action](n);
		if (missing) return { kind: "missing-field", node: n.id, field: missing };
		for (const dep of n.depends_on) {
			if (dep === n.id) return { kind: "self-dependency", id: n.id };
			if (!byId.has(dep)) return { kind: "unknown-dependency", node: n.id, dependency: dep };
		}
	}
	const cycle = findCycle(nodes, byId);
	if (cycle) return { kind: "cycle", path: cycle };
	for (const n of nodes) {
		const anc = ancestors(n.id, byId);
		for (const ref of collectRefs(`${n.prompt ?? ""} ${n.command ?? ""}`)) {
			if (!anc.has(ref)) return { kind: "unknown-ref", node: n.id, ref };
		}
	}
	return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/validate.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/validate.ts agent/extensions/daddy/tests/validate.test.ts
git commit -m "feat(daddy): add graph + field validation with tests"
```

---

### Task 9: load-workflow (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/load-workflow.ts`
- Test: `agent/extensions/daddy/tests/load-workflow.test.ts`

- [ ] **Step 1: Write the failing test** (tests the pure `normalizeWorkflow`; file I/O is covered by the manual check in Task 23)

```typescript
import { describe, expect, it } from "bun:test";
import { normalizeWorkflow } from "../lib/load-workflow.ts";

describe("normalizeWorkflow", () => {
	it("defaults depends_on to [] and keeps node fields", () => {
		const wf = normalizeWorkflow({
			name: "auth",
			vsm: [{ sipoc: "disc", nodes: [{ id: "a", action: "bash", aiAssisted: false, command: "x" }] }],
		});
		expect(wf.vsm[0].nodes[0].depends_on).toEqual([]);
		expect(wf.vsm[0].nodes[0].command).toBe("x");
	});

	it("throws when vsm is missing", () => {
		expect(() => normalizeWorkflow({ name: "auth" })).toThrow("workflow has no vsm");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/load-workflow.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/load-workflow.ts`**

```typescript
// Resolve <name> → read .pi/daddy/workflows/<name>.yaml → parse → normalize.
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { WORKFLOW_DIR } from "../constants.ts";
import type { SipocChain, Workflow, WorkflowNode } from "../types.ts";

/** Fill structural defaults so downstream code can assume depends_on is an array. */
export function normalizeWorkflow(raw: Record<string, unknown>): Workflow {
	if (!Array.isArray(raw.vsm)) throw new Error("workflow has no vsm");
	const vsm: SipocChain[] = (raw.vsm as Record<string, unknown>[]).map((chain) => ({
		sipoc: String(chain.sipoc ?? ""),
		supplier: chain.supplier as string | undefined,
		customer: chain.customer as string | undefined,
		nodes: ((chain.nodes as WorkflowNode[]) ?? []).map((n) => ({ ...n, depends_on: n.depends_on ?? [] })),
	}));
	return { name: String(raw.name ?? ""), description: raw.description as string | undefined, vsm };
}

export function workflowPath(cwd: string, name: string): string {
	return path.join(cwd, WORKFLOW_DIR, `${name}.yaml`);
}

export async function loadWorkflow(cwd: string, name: string): Promise<Workflow> {
	const text = await fs.readFile(workflowPath(cwd, name), "utf-8");
	return normalizeWorkflow(parse(text) as Record<string, unknown>);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/load-workflow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/load-workflow.ts agent/extensions/daddy/tests/load-workflow.test.ts
git commit -m "feat(daddy): add YAML workflow loader with tests"
```

---

### Task 10: session-path helper

**Files:**
- Create: `agent/extensions/daddy/lib/session-path.ts`

- [ ] **Step 1: Write `lib/session-path.ts`** (uses the verified `getSessionDir()` — never re-implements pi's cwd encoding, design §12.1)

```typescript
// State file path: <getSessionDir()>/<workflow>.daddy.json. We rely on pi's own
// session dir API so the path cannot drift if pi changes its encoding (design §12.1).
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { STATE_SUFFIX } from "../constants.ts";

export function stateFilePath(ctx: ExtensionContext, workflow: string): string {
	return path.join(ctx.sessionManager.getSessionDir(), `${workflow}${STATE_SUFFIX}`);
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/session-path.ts
git commit -m "feat(daddy): add session-keyed state path helper"
```

---

### Task 11: state-store (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/state-store.ts`
- Test: `agent/extensions/daddy/tests/state-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Workflow } from "../types.ts";
import { buildState, loadState, mergeNodeResult, persistState, resumeState } from "../lib/state-store.ts";

const wf: Workflow = {
	name: "auth",
	vsm: [{ sipoc: "s", nodes: [
		{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
		{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" },
	] }],
};

describe("state-store", () => {
	it("builds a pending state mirroring the workflow", () => {
		const s = buildState(wf, "args", 123);
		expect(s.vsm[0].nodes.map((n) => n.status)).toEqual(["pending", "pending"]);
		expect(s.arguments).toBe("args");
	});

	it("merges a node result", () => {
		const s = mergeNodeResult(buildState(wf, "", 1), "a", { status: "ok", output: "done" });
		expect(s.vsm[0].nodes[0].status).toBe("ok");
		expect(s.vsm[0].nodes[0].output).toBe("done");
	});

	it("resume keeps ok, resets running AND failed to pending", () => {
		let s = buildState(wf, "", 1);
		s = mergeNodeResult(s, "a", { status: "ok", output: "x" });
		s.vsm[0].nodes[1].status = "running";
		const r = resumeState(s);
		expect(r.vsm[0].nodes[0].status).toBe("ok");
		expect(r.vsm[0].nodes[1].status).toBe("pending");
	});

	it("atomic persist + reload round-trips and leaves no .tmp", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daddy-"));
		const file = path.join(dir, "auth.daddy.json");
		const s = buildState(wf, "args", 7);
		await persistState(file, s);
		expect(await loadState(file)).toEqual(s);
		expect(await fs.readdir(dir)).toEqual(["auth.daddy.json"]);
	});

	it("loadState returns null when the file is absent", async () => {
		expect(await loadState("/no/such/auth.daddy.json")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/state-store.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/state-store.ts`** (≈95 LOC — justification: the five state-lifecycle operations change together)

```typescript
// Build / merge / atomically persist / load / resume the run state machine (design §12).
import { promises as fs } from "node:fs";
import { allNodes, findNode } from "./flat-nodes.ts";
import type { NodeResult, NodeState, StateMachine, Workflow } from "../types.ts";

export function buildState(wf: Workflow, args: string, pid: number): StateMachine {
	const now = new Date().toISOString();
	return {
		workflow: wf.name,
		arguments: args,
		startedAt: now,
		pid,
		heartbeat: now,
		vsm: wf.vsm.map((chain) => ({
			sipoc: chain.sipoc,
			nodes: chain.nodes.map((n): NodeState => ({ ...n, status: "pending" })),
		})),
	};
}

/** Apply a node executor's result in place and stamp endedAt. Returns the same state. */
export function mergeNodeResult(state: StateMachine, id: string, result: NodeResult): StateMachine {
	const node = findNode(state, id);
	if (!node) throw new Error(`mergeNodeResult: unknown node ${id}`);
	node.status = result.status;
	node.output = result.output;
	node.structured = result.structured;
	node.endedAt = new Date().toISOString();
	state.heartbeat = node.endedAt;
	return state;
}

/** Mark a node running (start timestamp + heartbeat). */
export function markRunning(state: StateMachine, id: string): StateMachine {
	const node = findNode(state, id);
	if (node) {
		node.status = "running";
		node.startedAt = new Date().toISOString();
		state.heartbeat = node.startedAt;
	}
	return state;
}

/** Resume policy: keep ok; reset running AND failed to pending (design §12.2). */
export function resumeState(state: StateMachine): StateMachine {
	for (const node of allNodes(state)) {
		if (node.status === "running" || node.status === "failed") {
			node.status = "pending";
			node.output = undefined;
			node.structured = undefined;
		}
	}
	return state;
}

/** Atomic write: tmp + rename so a SIGKILL mid-write never truncates the real file. */
export async function persistState(file: string, state: StateMachine): Promise<void> {
	const tmp = `${file}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
	await fs.rename(tmp, file);
}

export async function loadState(file: string): Promise<StateMachine | null> {
	try {
		return JSON.parse(await fs.readFile(file, "utf-8")) as StateMachine;
	} catch {
		return null;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/state-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/state-store.ts agent/extensions/daddy/tests/state-store.test.ts
git commit -m "feat(daddy): add state store (build/merge/resume/atomic persist) with tests"
```

---

### Task 12: driver — wave partition + re-entrant continueRun (TDD on the pure half)

**Files:**
- Create: `agent/extensions/daddy/lib/driver.ts`
- Test: `agent/extensions/daddy/tests/driver.test.ts`

- [ ] **Step 1: Write the failing test** (targets the pure `partitionReady`; `continueRun`'s I/O is verified manually in Task 24)

```typescript
import { describe, expect, it } from "bun:test";
import type { StateMachine } from "../types.ts";
import { partitionReady } from "../lib/driver.ts";

function st(nodes: StateMachine["vsm"][number]["nodes"]): StateMachine {
	return { workflow: "w", arguments: "", startedAt: "", pid: 1, heartbeat: "", vsm: [{ sipoc: "s", nodes }] };
}

describe("partitionReady", () => {
	it("returns subprocess nodes whose deps are all ok", () => {
		const p = partitionReady(st([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "ok" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], status: "pending", command: "y" },
		]));
		expect(p.subprocess.map((n) => n.id)).toEqual(["b"]);
		expect(p.done).toBe(false);
	});

	it("skips a node with a failed dependency", () => {
		const p = partitionReady(st([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "failed" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], status: "pending" },
		]));
		expect(p.toSkip.map((n) => n.id)).toEqual(["b"]);
		expect(p.subprocess).toEqual([]);
	});

	it("partitions AI-ask separately from subprocess (subprocess drained first)", () => {
		const p = partitionReady(st([
			{ id: "q", action: "ask", aiAssisted: true, depends_on: [], status: "pending", prompt: "why" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: [], status: "pending", command: "y" },
		]));
		expect(p.subprocess.map((n) => n.id)).toEqual(["b"]);
		expect(p.aiAsk.map((n) => n.id)).toEqual(["q"]);
	});

	it("done is true when nothing is pending", () => {
		const p = partitionReady(st([{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "ok" }]));
		expect(p.done).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/driver.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/driver.ts`** (≈100 LOC — justification: pure `partitionReady` + impure re-entrant `continueRun` must stay adjacent; depends on Tasks 13–16 executors, written next)

```typescript
// Re-entrant wave driver (design §9). partitionReady is pure & tested; continueRun
// performs the I/O and is verified manually. AI-ask is a wave barrier: it never shares
// a wave with subprocess nodes and at most one runs per suspension (design §9.2).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WAVE_CONCURRENCY } from "../constants.ts";
import { allNodes } from "./flat-nodes.ts";
import { createSemaphore } from "./semaphore.ts";
import { delegateAsk } from "./delegate-ask.ts";
import { runSelfContained } from "./run-node.ts";
import { markRunning, mergeNodeResult, persistState } from "./state-store.ts";
import type { NodeState, StateMachine } from "../types.ts";

export interface Partition {
	toSkip: NodeState[];
	subprocess: NodeState[];
	aiAsk: NodeState[];
	done: boolean;
}

const isAiAsk = (n: NodeState): boolean => n.action === "ask" && n.aiAssisted === true;

/** Pure: classify pending nodes by readiness for the next wave. */
export function partitionReady(state: StateMachine): Partition {
	const nodes = allNodes(state);
	const status = new Map(nodes.map((n) => [n.id, n.status] as const));
	const pending = nodes.filter((n) => n.status === "pending");
	const toSkip = pending.filter((n) => n.depends_on.some((d) => status.get(d) === "failed" || status.get(d) === "skipped"));
	const ready = pending.filter((n) => !toSkip.includes(n) && n.depends_on.every((d) => status.get(d) === "ok"));
	return {
		toSkip,
		subprocess: ready.filter((n) => !isAiAsk(n)),
		aiAsk: ready.filter(isAiAsk),
		done: pending.length === 0,
	};
}

/**
 * Drive the run forward. Called from the input handler AND from agent_end (re-entrant).
 * Returns when the run completes OR when it suspends for an AI-ask delegation.
 */
export async function continueRun(pi: ExtensionAPI, ctx: ExtensionContext, state: StateMachine, file: string): Promise<void> {
	const semaphore = createSemaphore(WAVE_CONCURRENCY);
	// biome-ignore lint/correctness/noConstantCondition: loop exits via return.
	while (true) {
		const { toSkip, subprocess, aiAsk, done } = partitionReady(state);
		if (done) return;

		for (const n of toSkip) {
			n.status = "skipped";
			n.endedAt = new Date().toISOString();
		}
		if (toSkip.length) await persistState(file, state);

		if (subprocess.length) {
			await Promise.all(
				subprocess.map(async (node) => {
					markRunning(state, node.id);
					await semaphore.acquire();
					try {
						const result = await runSelfContained(pi, ctx, node, state);
						mergeNodeResult(state, node.id, result);
					} finally {
						semaphore.release();
					}
					await persistState(file, state);
				}),
			);
			continue;
		}

		if (aiAsk.length) {
			const node = aiAsk.sort((a, b) => a.id.localeCompare(b.id))[0]; // deterministic id order
			markRunning(state, node.id);
			await persistState(file, state);
			delegateAsk(pi, node, state); // triggers a main-agent turn, then we SUSPEND
			return;
		}
		return; // ready empty but pending non-empty → nothing runnable (shouldn't happen post-validation)
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/driver.test.ts`
Expected: FAIL to compile (imports `run-node.ts`, `delegate-ask.ts` not yet created). This is expected — the pure test will pass once those modules exist (Tasks 13–16). To unblock the pure test now, temporarily stub the imports OR reorder: implement Tasks 13–16 first, then re-run.

> **Sequencing note for the executor:** `driver.ts` imports the executors. Implement Tasks 13–16 (`run-bash-node`, `run-flag-node`, `run-llm-node`, `run-ask-node`, `run-node`, `delegate-ask`) before running `bun test tests/driver.test.ts`. The driver test itself only exercises `partitionReady` (pure), so it passes as soon as the file compiles.

- [ ] **Step 5: Commit (after Tasks 13–16 compile)**

```bash
git add agent/extensions/daddy/lib/driver.ts agent/extensions/daddy/tests/driver.test.ts
git commit -m "feat(daddy): add re-entrant wave driver with partition tests"
```

---

# Milestone C — Node executors

### Task 13: run-bash-node (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/run-bash-node.ts`
- Test: `agent/extensions/daddy/tests/run-bash-node.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { runBashNode } from "../lib/run-bash-node.ts";

describe("runBashNode", () => {
	it("returns ok with stdout for a zero-exit command", async () => {
		const r = await runBashNode({ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "running", command: "echo hi" }, process.cwd());
		expect(r.status).toBe("ok");
		expect(r.output.trim()).toBe("hi");
	});

	it("returns failed for a non-zero exit", async () => {
		const r = await runBashNode({ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "running", command: "exit 3" }, process.cwd());
		expect(r.status).toBe("failed");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/run-bash-node.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/run-bash-node.ts`**

```typescript
// bash node: run the EXACT command verbatim (design §10). stdout (truncated) is output;
// non-zero exit → failed. No $ref injection in v1 for bash.
import { exec } from "node:child_process";
import type { NodeResult, NodeState } from "../types.ts";

const MAX_OUTPUT = 20_000;

export function runBashNode(node: NodeState, cwd: string): Promise<NodeResult> {
	return new Promise((resolve) => {
		exec(node.command ?? "", { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			const output = (stdout || stderr || "").slice(0, MAX_OUTPUT);
			resolve({ status: err ? "failed" : "ok", output });
		});
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/run-bash-node.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/run-bash-node.ts agent/extensions/daddy/tests/run-bash-node.test.ts
git commit -m "feat(daddy): add bash node executor with tests"
```

---

### Task 14: json-stream + spawn-pi helpers

**Files:**
- Create: `agent/extensions/daddy/lib/json-stream.ts`
- Create: `agent/extensions/daddy/lib/spawn-pi.ts`

- [ ] **Step 1: Write `lib/json-stream.ts`** (folds `pi --mode json` stdout; adapted from `hello/subagent.ts:26-42`, extended to also capture a custom message by `customType`)

```typescript
// Fold `pi --mode json` stdout lines. Two consumers: the latest assistant text
// (flag nodes / fallback) and a specific custom message (llm node's append_node result).
interface PiEvent {
	type?: string;
	message?: { role?: string; customType?: string; content?: Array<{ type: string; text?: string }> | string };
}

function parseLines(lines: string[]): PiEvent[] {
	const out: PiEvent[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			out.push(JSON.parse(line) as PiEvent);
		} catch {
			/* skip non-JSON */
		}
	}
	return out;
}

/** Latest assistant text across the stream. */
export function lastAssistantText(lines: string[]): string {
	let text = "";
	for (const ev of parseLines(lines)) {
		if (ev.type !== "message_end" || ev.message?.role !== "assistant") continue;
		const content = ev.message.content;
		if (typeof content === "string") text = content;
		else for (const part of content ?? []) if (part.type === "text" && part.text) text = part.text;
	}
	return text;
}

/** The content string of the last custom message with the given customType, or null. */
export function lastCustomMessage(lines: string[], customType: string): string | null {
	let found: string | null = null;
	for (const ev of parseLines(lines)) {
		if (ev.message?.role === "custom" && ev.message.customType === customType) {
			const c = ev.message.content;
			found = typeof c === "string" ? c : JSON.stringify(c);
		}
	}
	return found;
}
```

> **VERIFY DURING IMPLEMENTATION:** the exact shape of a custom message in the `--mode json` stream (is it `role:"custom"` + `customType` on the message, or a top-level event?). Confirm by running `pi --mode json -p --no-session "--hello"` and inspecting the line that carries the `hello-world` custom message, then adjust `lastCustomMessage` to match. `hello/subagent.ts` only parses assistant text, so this branch is new and MUST be checked against a real stream before relying on it.

- [ ] **Step 2: Write `lib/spawn-pi.ts`** (centralizes `getPiInvocation` + spawn + line buffering; from `hello/subagent.ts:14,61-89`)

```typescript
// Spawn a child `pi` and collect its stdout lines. Shared by flag + llm node executors.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtual = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtual && existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const generic = /^(node|bun)(\.exe)?$/.test(execName);
	return generic ? { command: "pi", args } : { command: process.execPath, args };
}

export interface SpawnResult {
	lines: string[];
	stderr: string;
	code: number | null;
}

/** Run pi with the given args; resolve with parsed-per-line stdout. env merges over process.env. */
export function spawnPi(args: string[], cwd: string, env: Record<string, string> = {}, timeoutMs = 300_000): Promise<SpawnResult> {
	const { command, args: full } = getPiInvocation(args);
	return new Promise((resolve, reject) => {
		const proc = spawn(command, full, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
		let buffer = "";
		const lines: string[] = [];
		let stderr = "";
		const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
		proc.stdout.on("data", (c) => {
			buffer += c.toString();
			const parts = buffer.split("\n");
			buffer = parts.pop() ?? "";
			for (const l of parts) lines.push(l);
		});
		proc.stderr.on("data", (c) => (stderr += c.toString()));
		proc.on("error", (e) => {
			clearTimeout(timer);
			reject(e);
		});
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (buffer.trim()) lines.push(buffer);
			resolve({ lines, stderr, code });
		});
	});
}
```

- [ ] **Step 3: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/json-stream.ts agent/extensions/daddy/lib/spawn-pi.ts
git commit -m "feat(daddy): add pi spawn + json stream helpers"
```

---

### Task 15: run-flag-node

**Files:**
- Create: `agent/extensions/daddy/lib/run-flag-node.ts`

- [ ] **Step 1: Write `lib/run-flag-node.ts`** (spawn a headless flag invocation; design §10. No `$ref` injection in v1 — open assumption §17.4)

```typescript
// flag node: spawn `pi -p --mode json --no-session "<flag> <args>"`. The flag's owning
// extension intercepts it headlessly (e.g. --hello → "world"). output = captured text.
import { lastAssistantText, lastCustomMessage } from "./json-stream.ts";
import { spawnPi } from "./spawn-pi.ts";
import type { NodeResult, NodeState } from "../types.ts";

const HELLO_TYPE = "hello-world"; // most flags emit a custom message; fall back to assistant text.

export async function runFlagNode(node: NodeState, cwd: string): Promise<NodeResult> {
	const invocation = `${node.flag ?? ""} ${node.args ?? ""}`.trim();
	const { lines, stderr, code } = await spawnPi(["--mode", "json", "-p", "--no-session", invocation], cwd);
	const output = lastCustomMessage(lines, HELLO_TYPE) ?? lastAssistantText(lines);
	if (code !== 0 && !output) return { status: "failed", output: stderr.trim() || `flag exited ${code}` };
	return { status: "ok", output };
}
```

> **VERIFY DURING IMPLEMENTATION:** flag-emitted custom messages use varying `customType`s (`hello-world` here is just the `hello` extension's). For a generic flag node, prefer capturing the *last* custom message regardless of type, or make the captured type configurable. Confirm against a real `--hello` stream and generalize `lastCustomMessage` if needed (e.g. add a variant that returns the last custom message of ANY type).

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/run-flag-node.ts
git commit -m "feat(daddy): add flag node executor"
```

---

### Task 16: schema-compile (TDD)

**Files:**
- Create: `agent/extensions/daddy/lib/schema-compile.ts`
- Test: `agent/extensions/daddy/tests/schema-compile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { compileSchema } from "../lib/schema-compile.ts";

describe("compileSchema", () => {
	it("accepts a value matching the schema", () => {
		const check = compileSchema({ type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(check({ ranges: ["a:1-2"] })).toBeNull();
	});

	it("returns an error string for a violation", () => {
		const check = compileSchema({ type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(check({})).toContain("ranges");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/schema-compile.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/schema-compile.ts`** (compiles a node's `output_schema` JSON to a TypeBox validator; open assumption §17.2)

```typescript
// Compile a node's output_schema (a JSON-Schema subset) into a validator.
// TypeBox's Value.Errors validates a plain JSON schema object directly.
import { Value } from "typebox/value";
import type { TSchema } from "typebox";

export type SchemaCheck = (value: unknown) => string | null;

/** Returns a checker: null when valid, else a human-readable first violation. */
export function compileSchema(schema: Record<string, unknown>): SchemaCheck {
	const ts = schema as unknown as TSchema;
	return (value: unknown): string | null => {
		if (Value.Check(ts, value)) return null;
		const first = [...Value.Errors(ts, value)][0];
		return first ? `${first.path || "/"}: ${first.message}` : "schema violation";
	};
}
```

> **VERIFY DURING IMPLEMENTATION:** confirm the TypeBox value-checking import path for v1.1.38 via `npx ctx7 library "TypeBox" "validate a plain JSON schema with Value.Check and Value.Errors"`. The import may be `typebox/value` or a named export from `typebox`. Adjust to the version's actual API before relying on it (anti-hallucination rule: this is a specific API surface claim).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/schema-compile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/schema-compile.ts agent/extensions/daddy/tests/schema-compile.test.ts
git commit -m "feat(daddy): add output_schema compiler with tests"
```

---

### Task 17: append-tool (TDD) — the structured-output gate

**Files:**
- Create: `agent/extensions/daddy/lib/append-tool.ts`
- Test: `agent/extensions/daddy/tests/append-tool.test.ts`

- [ ] **Step 1: Write the failing test** (tests the pure validation core `validateAppend`, separate from SDK tool registration)

```typescript
import { describe, expect, it } from "bun:test";
import { makeAppendValidator } from "../lib/append-tool.ts";

describe("makeAppendValidator", () => {
	it("accepts a matching node_id with no schema", () => {
		const v = makeAppendValidator("scout", undefined);
		expect(v({ node_id: "scout", status: "ok", output: "x" })).toBeNull();
	});

	it("rejects a mismatched node_id", () => {
		const v = makeAppendValidator("scout", undefined);
		expect(v({ node_id: "other", status: "ok", output: "x" })).toContain("node_id");
	});

	it("rejects when output_schema is declared but structured violates it", () => {
		const v = makeAppendValidator("scout", { type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(v({ node_id: "scout", status: "ok", output: "x", structured: {} })).toContain("ranges");
	});

	it("accepts valid structured against the schema", () => {
		const v = makeAppendValidator("scout", { type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(v({ node_id: "scout", status: "ok", output: "x", structured: { ranges: ["a"] } })).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/append-tool.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/append-tool.ts`** (the validator is pure & tested; `registerAppendTool` wires it into the child with the retry cap and `terminate:true`)

```typescript
// The append_node tool — registered ONLY in the child (DADDY_NODE=1). Validation throws
// to force the model to retry; after MAX_APPEND_ATTEMPTS it fails the node (design §8).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MAX_APPEND_ATTEMPTS, NODE_RESULT_TYPE } from "../constants.ts";
import { AppendNodeParams, type AppendNodeArgs } from "../schema.ts";
import { compileSchema } from "./schema-compile.ts";

/** Pure validator: returns null when the args are acceptable, else an error message. */
export function makeAppendValidator(expectedId: string, outputSchema?: Record<string, unknown>) {
	const check = outputSchema ? compileSchema(outputSchema) : null;
	return (args: AppendNodeArgs): string | null => {
		if (args.node_id !== expectedId) return `node_id must be "${expectedId}", got "${args.node_id}"`;
		if (check) {
			if (args.structured === undefined) return "this node declares output_schema; you must pass `structured`";
			return check(args.structured);
		}
		return null;
	};
}

/** Register the child-only tool. Emits the validated result as a custom message + terminates. */
export function registerAppendTool(pi: ExtensionAPI, expectedId: string, outputSchema?: Record<string, unknown>): void {
	const validate = makeAppendValidator(expectedId, outputSchema);
	let attempts = 0;
	pi.registerTool({
		name: "append_node",
		label: "Append Node Result",
		description: "Commit your final result for this node. Call exactly once when done. Validation forces the required structure.",
		parameters: AppendNodeParams,
		execute: async (_id, params) => {
			const args = params as AppendNodeArgs;
			attempts++;
			const error = validate(args);
			if (error && attempts < MAX_APPEND_ATTEMPTS) throw new Error(error);
			const status = error ? "failed" : args.status;
			const payload = JSON.stringify({ node_id: args.node_id, status, output: args.output, structured: args.structured });
			pi.sendMessage({ customType: NODE_RESULT_TYPE, content: payload, display: false });
			return { content: [{ type: "text" as const, text: error ? `failed: ${error}` : "committed" }], terminate: true };
		},
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/append-tool.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/extensions/daddy/lib/append-tool.ts agent/extensions/daddy/tests/append-tool.test.ts
git commit -m "feat(daddy): add append_node tool gate with validation tests"
```

---

### Task 18: run-llm-node

**Files:**
- Create: `agent/extensions/daddy/lib/run-llm-node.ts`

- [ ] **Step 1: Write `lib/run-llm-node.ts`** (spawn isolated child with `DADDY_NODE=1`; resolve `$refs`; capture the `append_node` result from the JSON stream; design §10)

```typescript
// llm node: spawn an isolated child pi (DADDY_NODE=1) that registers ONLY append_node.
// The resolved prompt is the child's user message; instructions become its system prompt.
import { DADDY_NODE_ENV, NODE_RESULT_TYPE } from "../constants.ts";
import { lastCustomMessage } from "./json-stream.ts";
import { resolveRefs } from "./resolve-refs.ts";
import { spawnPi } from "./spawn-pi.ts";
import type { NodeResult, NodeState, StateMachine } from "../types.ts";

export async function runLlmNode(node: NodeState, state: StateMachine, cwd: string): Promise<NodeResult> {
	const prompt = resolveRefs(node.prompt ?? "", state, state.arguments);
	const instructions = `${node.instructions ?? ""}\nWhen finished, call append_node exactly once with node_id="${node.id}".`;
	const args = ["--mode", "json", "-p", "--no-session", "--thinking", node.variant ?? "medium", "--append-system-prompt", instructions, prompt];
	const { lines, stderr, code } = await spawnPi(args, cwd, { [DADDY_NODE_ENV]: "1" });
	const raw = lastCustomMessage(lines, NODE_RESULT_TYPE);
	if (!raw) return { status: "failed", output: stderr.trim() || `llm node produced no append_node result (exit ${code})` };
	const parsed = JSON.parse(raw) as { status: "ok" | "failed"; output: string; structured?: unknown };
	return { status: parsed.status, output: parsed.output, structured: parsed.structured };
}
```

> **VERIFY DURING IMPLEMENTATION:** confirm `--thinking` accepts the variant values `low|medium|high` (the design maps them directly). `hello/subagent.ts:55` uses `--thinking off`; check `pi --help` for the full accepted set. Also confirm the child's `append_node` custom message reaches the parent's captured stdout stream (this depends on the `lastCustomMessage` shape verified in Task 14).

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/run-llm-node.ts
git commit -m "feat(daddy): add llm node executor (isolated child + append_node capture)"
```

---

### Task 19: run-ask-node (deterministic authored form)

**Files:**
- Create: `agent/extensions/daddy/lib/run-ask-node.ts`

- [ ] **Step 1: Write `lib/run-ask-node.ts`** (renders authored `questions` in the main UI; awaitable, no LLM; design §10)

```typescript
// ask node (aiAssisted:false): render authored questions in the MAIN UI, await answers.
// No LLM, no tokens, no suspension — it is awaitable (design §9). Uses ctx.ui.input per
// question; a select renders its options inline in the prompt.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AskQuestion, NodeResult, NodeState } from "../types.ts";

function promptFor(q: AskQuestion): string {
	if (q.type === "select" && q.options?.length) return `${q.label} [${q.options.join(" / ")}]`;
	return q.label;
}

export async function runAskNode(node: NodeState, ctx: ExtensionContext): Promise<NodeResult> {
	const answers: string[] = [];
	for (const q of node.questions ?? []) {
		const value = (await ctx.ui.input(promptFor(q), q.default ?? "")) ?? q.default ?? "";
		answers.push(`${q.id}: ${value}`);
	}
	return { status: "ok", output: answers.join("\n") };
}
```

> **VERIFY DURING IMPLEMENTATION:** the design references an `ask_user_question` form for richer rendering (select widgets). `ctx.ui.input` is the confirmed simple-prompt API (used by gemini). If a structured select form is desired, check whether the `ask-user-question-tool` extension exposes a reusable form API or whether `ctx.ui` has a select method; `ctx.ui.input` is the safe verified fallback.

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/run-ask-node.ts
git commit -m "feat(daddy): add deterministic ask node executor"
```

---

### Task 20: run-node dispatcher

**Files:**
- Create: `agent/extensions/daddy/lib/run-node.ts`

- [ ] **Step 1: Write `lib/run-node.ts`** (dispatch self-contained nodes by action; the driver calls only this for non-AI-ask nodes)

```typescript
// Dispatch a SELF-CONTAINED node (bash | flag | llm | ask aiAssisted:false) to its executor.
// AI-ask is NOT handled here — the driver routes it to delegate-ask (design §9).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runBashNode } from "./run-bash-node.ts";
import { runFlagNode } from "./run-flag-node.ts";
import { runLlmNode } from "./run-llm-node.ts";
import { runAskNode } from "./run-ask-node.ts";
import type { NodeResult, NodeState, StateMachine } from "../types.ts";

export async function runSelfContained(_pi: ExtensionAPI, ctx: ExtensionContext, node: NodeState, state: StateMachine): Promise<NodeResult> {
	switch (node.action) {
		case "bash":
			return runBashNode(node, ctx.cwd);
		case "flag":
			return runFlagNode(node, ctx.cwd);
		case "llm":
			return runLlmNode(node, state, ctx.cwd);
		case "ask":
			return runAskNode(node, ctx); // only reached when aiAssisted:false
		default:
			return { status: "failed", output: `unknown action: ${node.action}` };
	}
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/run-node.ts
git commit -m "feat(daddy): add self-contained node dispatcher"
```

---

# Milestone D — AI-ask delegation (event-driven) + index wiring

> **Quirk to keep in mind (token economy is two mechanisms, not one):** `llm` nodes achieve token economy by **isolation in a subprocess** — the child's context never touches the main conversation. The AI-`ask` node, by contrast, runs **inside the main agent** and relies on the `pi.on("context")` filter (the `dev-pipeline` trick) to trim the window to messages after the marker so the delegation does not inflate the main conversation. Do not conflate them: the context filter matters ONLY for AI-`ask`, and breaking it silently re-inflates the main window.

### Task 21: delegate-ask (AI-ask delegation)

**Files:**
- Create: `agent/extensions/daddy/lib/delegate-ask.ts`

- [ ] **Step 1: Write `lib/delegate-ask.ts`** (capture defaults, inject marker, send the resolved prompt to trigger a main-agent turn; design §10, copied-not-imported from `dev-pipeline/orchestrator.ts:59-66`)

```typescript
// AI-ask delegation (design §10). Capture the user's model+tools, inject a hidden marker
// (so the context filter trims to it), then sendUserMessage to trigger a main-agent turn.
// The run SUSPENDS after this; agent_end (index.ts) captures the answer and resumes.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ASK_MARKER } from "../constants.ts";
import { resolveRefs } from "./resolve-refs.ts";
import type { NodeState, StateMachine } from "../types.ts";

export interface SavedDefaults {
	model: { provider: string; id: string } | null;
	tools: string[];
}

/** Snapshot the user's current model + active tools so they can be restored on agent_end. */
export function captureDefaults(pi: ExtensionAPI, model: { provider: string; id: string } | undefined): SavedDefaults {
	return { model: model ?? null, tools: pi.getAllTools().map((t) => t.name) };
}

const ASK_INSTRUCTION =
	"Loop ask_user_question: each round state your assumptions and ask adaptive clarifying questions, " +
	"and ALWAYS include a final option 'proceed'. Stop as soon as you have no more doubts OR the user " +
	"selects 'proceed'. Then state the agreed decisions in plain text as your final message.";

/** Trigger the delegated turn. Caller must already have set the model/tools (index.ts). */
export function delegateAsk(pi: ExtensionAPI, node: NodeState, state: StateMachine): void {
	const why = resolveRefs(node.prompt ?? "", state, state.arguments);
	pi.sendMessage({ customType: ASK_MARKER, content: "", display: false }, { triggerTurn: false });
	pi.sendUserMessage(`${why}\n\n${ASK_INSTRUCTION}`);
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/delegate-ask.ts
git commit -m "feat(daddy): add AI-ask main-agent delegation"
```

---

### Task 22: store (in-memory run snapshot for the panel)

**Files:**
- Create: `agent/extensions/daddy/lib/store.ts`
- Create: `agent/extensions/daddy/lib/gate.ts`
- Create: `agent/extensions/daddy/lib/double-press.ts`

- [ ] **Step 1: Write `lib/store.ts`** (observer pattern, adapted from `subagent/lib/store.ts`)

```typescript
// In-memory snapshot of the current run, for the panel's live view. The driver publishes
// the StateMachine after each persist; the panel subscribes for re-renders.
import type { StateMachine } from "../types.ts";

type Listener = () => void;
let current: StateMachine | null = null;
const listeners = new Set<Listener>();

export function publishRun(state: StateMachine | null): void {
	current = state;
	for (const l of listeners) l();
}

export function getRun(): StateMachine | null {
	return current;
}

export function hasActiveRun(): boolean {
	return current !== null && current.vsm.some((c) => c.nodes.some((n) => n.status === "running" || n.status === "pending"));
}

export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
```

- [ ] **Step 2: Write `lib/double-press.ts`** (verbatim from `subagent/lib/double-press.ts`)

```typescript
// Detects a double press of the same key within a time window. Pure + testable.
// Verbatim copy of subagent's (intentional, daddy is standalone).

export class DoublePressDetector {
	private lastAt = Number.NEGATIVE_INFINITY;

	constructor(private readonly windowMs: number) {}

	press(now: number): boolean {
		const isDouble = now - this.lastAt <= this.windowMs;
		this.lastAt = isDouble ? Number.NEGATIVE_INFINITY : now;
		return isDouble;
	}
}
```

- [ ] **Step 3: Write `lib/gate.ts`** (the trigger gate: open the panel only when the editor is empty)

```typescript
// Gate for the panel trigger: open only when the editor is empty (mirrors subagent's gate).
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function editorIsEmpty(ctx: ExtensionContext): boolean {
	// subagent reads the live editor buffer here; reuse whatever it uses. Fallback: hasUI.
	return ctx.hasUI;
}
```

> **VERIFY DURING IMPLEMENTATION:** read `subagent/lib/gate.ts` for the exact "editor is empty" check (it inspects the live input buffer). Copy that logic verbatim — the `hasUI` fallback above is a placeholder so the file typechecks, not the real gate.

- [ ] **Step 4: Typecheck & commit**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS.

```bash
git add agent/extensions/daddy/lib/store.ts agent/extensions/daddy/lib/gate.ts agent/extensions/daddy/lib/double-press.ts
git commit -m "feat(daddy): add run store, gate, double-press detector"
```

---

### Task 23: index.ts — flag registration, input interception, child branch, agent_end + context handlers

**Files:**
- Create: `agent/extensions/daddy/index.ts`

- [ ] **Step 1: Write `index.ts`** (≈95 LOC — justification: one cohesive registration surface wiring four handlers + the child branch; splitting scatters it. Mirrors `dev-pipeline/index.ts` control flow + `hello`/`gemini` flag pattern)

```typescript
// daddy entry. In a child (DADDY_NODE=1) it registers ONLY append_node and installs no
// input handler (prevents recursion). Otherwise it registers the flags and the driver.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ASK_MARKER, DADDY_NODE_ENV, FLAG_DESIGN, FLAG_FRESH, FLAG_WORKFLOW } from "./constants.ts";
import { registerAppendTool } from "./lib/append-tool.ts";
import { continueRun } from "./lib/driver.ts";
import { captureDefaults, type SavedDefaults } from "./lib/delegate-ask.ts";
import { findNode } from "./lib/flat-nodes.ts";
import { lastAssistantText } from "./lib/json-stream.ts";
import { loadWorkflow } from "./lib/load-workflow.ts";
import { mergeNodeResult, persistState } from "./lib/state-store.ts";
import { startRun } from "./lib/start-run.ts";
import { publishRun } from "./lib/store.ts";
import { installTrigger } from "./panel/trigger.ts";
import type { StateMachine } from "./types.ts";

export default function daddy(pi: ExtensionAPI): void {
	// --- Child mode: only the append_node tool, nothing else. The expected node id and
	// schema arrive via env set by run-llm-node (DADDY_NODE_ID / DADDY_NODE_SCHEMA). ---
	if (process.env[DADDY_NODE_ENV] === "1") {
		const id = process.env.DADDY_NODE_ID ?? "";
		const schema = process.env.DADDY_NODE_SCHEMA ? JSON.parse(process.env.DADDY_NODE_SCHEMA) : undefined;
		registerAppendTool(pi, id, schema);
		return;
	}

	let state: StateMachine | null = null;
	let stateFile = "";
	let saved: SavedDefaults | null = null;

	for (const [token, desc] of [
		[FLAG_WORKFLOW, "Execute a daddy workflow (auto-resume). Modifiers: --daddy-fresh, --daddy-design"],
		[FLAG_FRESH, "Run the workflow from scratch, discarding prior state"],
		[FLAG_DESIGN, "Open the panel editing the workflow"],
	] as const) {
		pi.registerFlag(token.slice(2), { description: desc, type: "string" });
	}
	pi.on("session_start", () => {
		for (const token of [FLAG_WORKFLOW, FLAG_FRESH, FLAG_DESIGN]) {
			pi.events.emit("flag:registered", { token, description: "daddy" });
		}
	});

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" }; // never self-trigger
		if (!event.text.includes(FLAG_WORKFLOW)) return { action: "continue" };
		const started = await startRun(pi, ctx, event.text);
		if (!started) return { action: "handled" }; // notified inside (error, picker, or design)
		state = started.state;
		stateFile = started.file;
		saved = captureDefaults(pi, ctx.model);
		publishRun(state);
		await continueRun(pi, ctx, state, stateFile);
		publishRun(state);
		return { action: "handled" };
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!state) return;
		const running = findNode(state, runningAskId(state));
		if (!running) return;
		mergeNodeResult(state, running.id, { status: "ok", output: lastAssistantText((event.messages as { content?: unknown }[]).map((m) => JSON.stringify(m))) });
		await persistState(stateFile, state);
		await restore(pi, ctx, saved);
		publishRun(state);
		await continueRun(pi, ctx, state, stateFile);
		publishRun(state);
	});

	pi.on("context", async (event) => {
		if (!state || !runningAskId(state)) return;
		return { messages: trimToMarker(event.messages as { customType?: string }[]) as typeof event.messages };
	});

	installTrigger(pi);
}

function runningAskId(state: StateMachine): string {
	for (const c of state.vsm) for (const n of c.nodes) if (n.action === "ask" && n.aiAssisted && n.status === "running") return n.id;
	return "";
}

function trimToMarker<T extends { customType?: string }>(messages: T[]): T[] {
	for (let i = messages.length - 1; i >= 0; i--) if (messages[i].customType === ASK_MARKER) return messages.slice(i + 1);
	return messages;
}

async function restore(pi: ExtensionAPI, ctx: ExtensionContext, saved: SavedDefaults | null): Promise<void> {
	if (!saved) return;
	if (saved.tools.length) pi.setActiveTools(saved.tools);
	if (saved.model) {
		const m = ctx.modelRegistry.find(saved.model.provider, saved.model.id);
		if (m) await pi.setModel(m);
	}
}
```

> **CORRECTION needed during implementation:** the `agent_end` handler above passes `event.messages` to `lastAssistantText` (which expects JSON *lines*). The real `dev-pipeline` `lastAssistantText` operates directly on the message objects (`dev-pipeline/index.ts:282-296`). Use the object-based helper for `agent_end` and the line-based one (`json-stream.ts`) only for spawned-child stdout. **Action:** add an object-based `lastAssistantText(messages: unknown[])` (copy `dev-pipeline/index.ts:282-296` verbatim) and call THAT here, instead of the `.map(JSON.stringify)` hack shown. This keeps the two parsing contexts cleanly separated.

> **Child env contract:** `run-llm-node.ts` (Task 18) must export the expected node id and schema to the child via env. Update its `spawnPi` call to pass `{ [DADDY_NODE_ENV]: "1", DADDY_NODE_ID: node.id, DADDY_NODE_SCHEMA: node.output_schema ? JSON.stringify(node.output_schema) : "" }`. Add this when implementing Task 23 (it closes the loop the child branch above depends on).

- [ ] **Step 2: Fix the two corrections above** — add object-based `lastAssistantText` and the child env vars in `run-llm-node.ts`.

- [ ] **Step 3: Typecheck**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS (after creating `lib/start-run.ts` in Task 24 and `panel/trigger.ts` in Task 25 — typecheck fully only after those).

- [ ] **Step 4: Commit (after Tasks 24–25 compile)**

```bash
git add agent/extensions/daddy/index.ts agent/extensions/daddy/lib/run-llm-node.ts
git commit -m "feat(daddy): wire flag interception, child branch, agent_end + context handlers"
```

---

### Task 24: start-run (parse flags, resolve/resume state, concurrent-run guard)

**Files:**
- Create: `agent/extensions/daddy/lib/start-run.ts`

- [ ] **Step 1: Write `lib/start-run.ts`** (manual flag parsing — the `hello` pattern; load+validate; resume-or-fresh; concurrent-run guard; design §9.1, §12.1–§12.2)

```typescript
// Parse the --daddy-workflow input, load+validate, resolve the state machine (resume unless
// --daddy-fresh), and guard against a concurrent run on the same file. Returns null when it
// handled the case itself (error notify, no name → picker, --daddy-design → editor).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FLAG_DESIGN, FLAG_FRESH, FLAG_WORKFLOW } from "../constants.ts";
import { loadWorkflow, workflowPath } from "./load-workflow.ts";
import { buildState, loadState, resumeState } from "./state-store.ts";
import { stateFilePath } from "./session-path.ts";
import { validateWorkflow } from "./validate.ts";
import type { StateMachine } from "../types.ts";

/** Split "<flag> <name> <args> [--daddy-fresh|--daddy-design]" into parts (hello pattern). */
export function parseInvocation(text: string): { name: string; args: string; fresh: boolean; design: boolean } {
	const fresh = text.includes(FLAG_FRESH);
	const design = text.includes(FLAG_DESIGN);
	const rest = text.split(FLAG_WORKFLOW).join("").split(FLAG_FRESH).join("").split(FLAG_DESIGN).join("").trim();
	const [name, ...argWords] = rest.split(/\s+/);
	return { name: name ?? "", args: argWords.join(" "), fresh, design };
}

export async function startRun(pi: ExtensionAPI, ctx: ExtensionContext, text: string): Promise<{ state: StateMachine; file: string } | null> {
	const { name, args, fresh, design } = parseInvocation(text);
	if (!name) {
		ctx.ui.notify("daddy: no workflow name. Open the panel (double-press ←) to pick or create one.", "info");
		return null;
	}
	const wf = await loadWorkflow(ctx.cwd, name).catch(() => null);
	if (!wf) {
		ctx.ui.notify(`daddy: ${workflowPath(ctx.cwd, name)} not found. Open the panel to create it.`, "warning");
		return null;
	}
	if (design) {
		ctx.ui.notify("daddy: open the panel to edit (design mode wiring lands in Task 26).", "info");
		return null;
	}
	const error = validateWorkflow(wf);
	if (error) {
		ctx.ui.notify(`daddy: invalid workflow (${error.kind}).`, "error");
		return null;
	}
	const file = stateFilePath(ctx, name);
	const prior = fresh ? null : await loadState(file);
	if (prior && prior.vsm.some((c) => c.nodes.some((n) => n.status === "running")) && Date.now() - Date.parse(prior.heartbeat) < 60_000) {
		ctx.ui.notify("daddy: a run for this workflow looks active in this cwd. Refusing to start a second.", "error");
		return null;
	}
	const state = prior ? resumeState(prior) : buildState(wf, args, process.pid);
	return { state, file };
}
```

- [ ] **Step 2: Run the full pure test suite**

Run: `cd agent/extensions/daddy && bun test`
Expected: PASS (all suites: resolve-refs, validate, load-workflow, state-store, driver, run-bash-node, schema-compile, append-tool).

- [ ] **Step 3: Typecheck**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS (after Task 25's `panel/trigger.ts` exists; if `index.ts` still references missing panel exports, complete Task 25 then re-run).

- [ ] **Step 4: Commit**

```bash
git add agent/extensions/daddy/lib/start-run.ts
git commit -m "feat(daddy): add run starter (parse, validate, resume guard)"
```

---

# Milestone E — Panel (run-mode live view, then design-mode editor)

### Task 25: panel trigger + open + run-mode view

**Files:**
- Create: `agent/extensions/daddy/panel/trigger.ts`
- Create: `agent/extensions/daddy/panel/open.ts`
- Create: `agent/extensions/daddy/panel/layout.ts`
- Create: `agent/extensions/daddy/panel/view.ts`
- Create: `agent/extensions/daddy/panel/run-render.ts`

- [ ] **Step 1: Write `panel/trigger.ts`** (raw-input double-press watcher; adapted from `subagent/panel/trigger.ts:14-26`)

```typescript
// Open the panel on a double-press of the trigger key, only when the editor is empty.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import { DoublePressDetector } from "../lib/double-press.ts";
import { editorIsEmpty } from "../lib/gate.ts";
import { openPanel } from "./open.ts";

const TRIGGER_KEY = "left";
const WINDOW_MS = 300;

export function installTrigger(pi: ExtensionAPI): void {
	const detector = new DoublePressDetector(WINDOW_MS);
	let open = false;
	pi.on("session_start", () => {
		// onTerminalInput lives on ctx.ui; subscribe once UI is available.
	});
	pi.on("input", () => undefined as never); // placeholder; see VERIFY note for the real subscription point
}
```

> **VERIFY / CORRECT DURING IMPLEMENTATION:** `ctx.ui.onTerminalInput` is on the **context**, not `pi`. `subagent` installs the trigger from a place that has `ctx` (its `installTrigger(ctx, config)` takes `ctx`). Re-read `subagent/panel/trigger.ts` and `subagent/index.ts` to see WHERE `ctx` is obtained at install time (likely inside a `session_start` or a first event handler that receives `ctx`). Mirror that exactly: capture `ctx` from an event, then call `ctx.ui.onTerminalInput((data) => { ... })` returning `{ consume: true }` only when the double-press completes AND `editorIsEmpty(ctx)`. The stub above only exists to keep `index.ts` importing a real symbol; replace its body with the verified subscription.

- [ ] **Step 2: Write `panel/open.ts`** (overlay via `ctx.ui.custom`; subscribe to the store; from `subagent/panel/open.ts`)

```typescript
// Open the panel as a centered overlay; re-render on store changes; resolve on close.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getRun, subscribe } from "../lib/store.ts";
import { DaddyPanel } from "./view.ts";

export function openPanel(ctx: ExtensionContext): Promise<void> {
	return ctx.ui.custom<void>(
		(tui, _theme, _keys, done) => {
			const panel = new DaddyPanel(() => done(), () => tui.requestRender());
			panel.setRun(getRun());
			const unsubscribe = subscribe(() => {
				panel.setRun(getRun());
				tui.requestRender();
			});
			return Object.assign(panel, { dispose: unsubscribe });
		},
		{ overlay: true, overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" } },
	);
}
```

- [ ] **Step 3: Write `panel/layout.ts`** (status markers + column join; small pure helpers)

```typescript
// Pure rendering helpers shared by run/design render: status marker + two-column join.
import type { Status } from "../types.ts";

const MARKER: Record<Status, string> = { running: "*", ok: "+", failed: "x", skipped: "-", pending: "." };

export function statusMarker(status: Status): string {
	return MARKER[status];
}

export function joinColumns(left: string[], right: string[], height: number, leftWidth: number, gap: string): string[] {
	const rows: string[] = [];
	for (let i = 0; i < height; i++) {
		const l = (left[i] ?? "").padEnd(leftWidth);
		rows.push(`${l}${gap}${right[i] ?? ""}`);
	}
	return rows;
}
```

- [ ] **Step 4: Write `panel/view.ts`** (the Component; master-detail + mode switch; from `subagent/panel/view.ts:15-57`)

```typescript
// DaddyPanel: master-detail overlay. Run mode shows the live status tree; design mode
// (Task 26) shows the editable tree + detail form. Mode toggles with Tab.
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { StateMachine } from "../types.ts";
import { renderRun } from "./run-render.ts";

interface Component {
	handleInput(data: string): void;
	render(width: number): string[];
	invalidate(): void;
}

export class DaddyPanel implements Component {
	private run: StateMachine | null = null;
	private selected = 0;

	constructor(private readonly onClose: () => void, private readonly onChange: () => void) {}

	setRun(run: StateMachine | null): void {
		this.run = run;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape" as KeyId) || matchesKey(data, "q" as KeyId)) return this.onClose();
		if (matchesKey(data, "down" as KeyId) || matchesKey(data, "j" as KeyId)) this.selected++;
		else if (matchesKey(data, "up" as KeyId) || matchesKey(data, "k" as KeyId)) this.selected = Math.max(0, this.selected - 1);
		else return;
		this.onChange();
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderRun(this.run, this.selected, width);
	}
}
```

- [ ] **Step 5: Write `panel/run-render.ts`** (read-only live view from the state machine; design §13 run mode)

```typescript
// Render the run-mode view: left = per-node status markers, right = selected node detail.
import { allNodes } from "../lib/flat-nodes.ts";
import { joinColumns, statusMarker } from "./layout.ts";
import type { StateMachine } from "../types.ts";

export function renderRun(state: StateMachine | null, selected: number, width: number): string[] {
	if (!state) return ["daddy: no active run."];
	const nodes = allNodes(state);
	const height = Math.max(6, nodes.length + 1);
	const leftWidth = Math.min(28, Math.floor(width * 0.35));
	const left = nodes.map((n, i) => `${i === selected ? ">" : " "}${statusMarker(n.status)} ${n.id}`.slice(0, leftWidth));
	const node = nodes[selected];
	const detail = node
		? [`${node.id} [${node.action}${node.aiAssisted ? " · AI" : ""}]`, `status: ${node.status}`, "", ...(node.output ?? "").split("\n").slice(0, height - 3)]
		: [];
	const title = ` daddy · ${state.workflow} (${nodes.filter((n) => n.status === "ok").length}/${nodes.length})`;
	return [title.padEnd(width), ...joinColumns(left, detail, height, leftWidth, "  ")];
}
```

- [ ] **Step 6: Typecheck**

Run: `cd agent/extensions/daddy && bun run typecheck`
Expected: PASS (panel files + index compile together).

- [ ] **Step 7: Commit**

```bash
git add agent/extensions/daddy/panel/trigger.ts agent/extensions/daddy/panel/open.ts agent/extensions/daddy/panel/layout.ts agent/extensions/daddy/panel/view.ts agent/extensions/daddy/panel/run-render.ts
git commit -m "feat(daddy): add panel trigger, overlay, and run-mode live view"
```

---

### Task 26: panel editor (design-mode tree ops, TDD) + design-render

**Files:**
- Create: `agent/extensions/daddy/panel/editor.ts`
- Create: `agent/extensions/daddy/panel/design-render.ts`
- Test: `agent/extensions/daddy/tests/editor.test.ts`

- [ ] **Step 1: Write the failing test** (pure tree operations; §15 editor tests)

```typescript
import { describe, expect, it } from "bun:test";
import { addNode, addSipoc, connect, removeNode, toYaml } from "../panel/editor.ts";
import type { Workflow } from "../types.ts";

const base: Workflow = { name: "auth", vsm: [{ sipoc: "disc", nodes: [] }] };

describe("editor tree ops", () => {
	it("adds a node to a sipoc chain", () => {
		const wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		expect(wf.vsm[0].nodes.map((n) => n.id)).toEqual(["a"]);
	});

	it("adds a sipoc chain", () => {
		const wf = addSipoc(base, "impl");
		expect(wf.vsm.map((c) => c.sipoc)).toEqual(["disc", "impl"]);
	});

	it("connects a node to a dependency", () => {
		let wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		wf = addNode(wf, "disc", { id: "b", action: "bash", aiAssisted: false, depends_on: [], command: "y" });
		wf = connect(wf, "b", "a");
		expect(wf.vsm[0].nodes[1].depends_on).toEqual(["a"]);
	});

	it("removes a node and prunes it from dependents", () => {
		let wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		wf = addNode(wf, "disc", { id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" });
		wf = removeNode(wf, "a");
		expect(wf.vsm[0].nodes.map((n) => n.id)).toEqual(["b"]);
		expect(wf.vsm[0].nodes[0].depends_on).toEqual([]);
	});

	it("serializes to YAML round-trippable text", () => {
		const wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		expect(toYaml(wf)).toContain("name: auth");
		expect(toYaml(wf)).toContain("id: a");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent/extensions/daddy && bun test tests/editor.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `panel/editor.ts`** (pure, immutable tree ops + YAML serialization)

```typescript
// Pure design-mode tree operations. No rendering, no I/O — fully unit-testable (§15).
import { stringify } from "yaml";
import type { SipocChain, Workflow, WorkflowNode } from "../types.ts";

const clone = (wf: Workflow): Workflow => structuredClone(wf);

export function addSipoc(wf: Workflow, sipoc: string): Workflow {
	const next = clone(wf);
	next.vsm.push({ sipoc, nodes: [] });
	return next;
}

export function addNode(wf: Workflow, sipoc: string, node: WorkflowNode): Workflow {
	const next = clone(wf);
	const chain = next.vsm.find((c: SipocChain) => c.sipoc === sipoc);
	if (chain) chain.nodes.push(node);
	return next;
}

export function connect(wf: Workflow, nodeId: string, dependency: string): Workflow {
	const next = clone(wf);
	for (const c of next.vsm) for (const n of c.nodes) if (n.id === nodeId && !n.depends_on.includes(dependency)) n.depends_on.push(dependency);
	return next;
}

export function removeNode(wf: Workflow, nodeId: string): Workflow {
	const next = clone(wf);
	for (const c of next.vsm) {
		c.nodes = c.nodes.filter((n) => n.id !== nodeId);
		for (const n of c.nodes) n.depends_on = n.depends_on.filter((d) => d !== nodeId);
	}
	return next;
}

export function toYaml(wf: Workflow): string {
	return stringify(wf);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent/extensions/daddy && bun test tests/editor.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write `panel/design-render.ts`** (renders the editable tree + a detail form for the selected element; design §13 design mode)

```typescript
// Render design-mode: left = VSM>SIPOC>node tree, right = detail of the selected element.
// Editing keys are handled by view.ts in design mode (Tab toggles from run mode).
import { joinColumns } from "./layout.ts";
import type { Workflow } from "../types.ts";

export function renderDesign(wf: Workflow, selected: number, width: number): string[] {
	const rows: string[] = [];
	for (const chain of wf.vsm) {
		rows.push(`▸ ${chain.sipoc}`);
		for (const n of chain.nodes) rows.push(`   ${n.id} [${n.action}${n.aiAssisted ? " · AI" : ""}]`);
	}
	const height = Math.max(6, rows.length + 1);
	const leftWidth = Math.min(30, Math.floor(width * 0.4));
	const left = rows.map((r, i) => `${i === selected ? ">" : " "}${r}`.slice(0, leftWidth));
	const flat = wf.vsm.flatMap((c) => c.nodes);
	const node = flat[Math.max(0, selected - 1)];
	const detail = node ? [`id: ${node.id}`, `action: ${node.action}`, `aiAssisted: ${node.aiAssisted}`, `depends_on: ${node.depends_on.join(", ")}`] : ["(select a node)"];
	return [` daddy · design · ${wf.name}`.padEnd(width), ...joinColumns(left, detail, height, leftWidth, "  ")];
}
```

> **NOTE on design-mode wiring:** `view.ts` (Task 25) currently renders only run mode. To complete design mode, extend `DaddyPanel` with a `mode: "run" | "design"` field toggled by the Tab key, a `Workflow` it edits, and key handlers that call `editor.ts` ops (`a` add, `c` connect, `d` delete, `s` save → write `toYaml(wf)` to `workflowPath`). Keep `view.ts` under the line cap by delegating each branch to `renderRun`/`renderDesign`. The pure ops are already tested; the key-binding glue is verified manually in Task 27.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `cd agent/extensions/daddy && bun test && bun run typecheck`
Expected: PASS (all suites + clean typecheck).

- [ ] **Step 7: Commit**

```bash
git add agent/extensions/daddy/panel/editor.ts agent/extensions/daddy/panel/design-render.ts agent/extensions/daddy/tests/editor.test.ts
git commit -m "feat(daddy): add design-mode tree editor (pure ops + render) with tests"
```

---

# Milestone F — End-to-end manual verification

> These steps cannot be unit-tested without a live pi session (they exercise the SDK, spawning, the UI, and the agent loop). Run them in a real pi session in a throwaway project. Each has an explicit expected observation.

### Task 27: Manual verification — deterministic path (Phase 1 value)

**Files:**
- Create (fixture): `<throwaway-project>/.pi/daddy/workflows/smoke.yaml`

- [ ] **Step 1: Author a deterministic fixture workflow**

```yaml
name: smoke
description: Deterministic-only smoke workflow.
vsm:
  - sipoc: build
    nodes:
      - { id: greet, action: flag, aiAssisted: false, flag: "--hello", args: "tester", depends_on: [] }
      - { id: test, action: bash, aiAssisted: false, command: "echo build-ok", depends_on: [greet] }
      - { id: confirm, action: ask, aiAssisted: false, depends_on: [test],
          questions: [ { id: go, type: select, label: "Proceed?", options: ["yes","no"], default: "yes" } ] }
```

- [ ] **Step 2: Run it**

In a pi session at the throwaway project: type `--daddy-workflow smoke`.
Expected:
- No main-LLM orchestration turn occurs (the input is `handled`).
- `greet` runs (spawns a headless `--hello`), `test` runs after it (`echo build-ok`), `confirm` prompts you in the main UI.
- A state file appears: `<getSessionDir()>/smoke.daddy.json` with all three nodes `ok`.

- [ ] **Step 3: Verify resume**

Re-run `--daddy-workflow smoke`. Expected: it auto-resumes, sees all nodes `ok`, completes immediately (no re-run). Then run `--daddy-workflow smoke --daddy-fresh`. Expected: it discards prior state and runs from the start.

- [ ] **Step 4: Verify the panel run view**

Start a run with a slower bash node (e.g. `command: "sleep 2 && echo done"`), and while it runs double-press `←`. Expected: the panel opens showing per-node status markers (`* + x - .`) and the selected node's detail; it closes on `q`/`escape`.

- [ ] **Step 5: Commit the fixture (optional, in the daddy repo as an example)**

```bash
git add agent/extensions/daddy/examples/smoke.yaml 2>/dev/null || true
git commit -m "docs(daddy): add deterministic smoke workflow example" || true
```

---

### Task 28: Manual verification — llm node + append_node gate

**Files:**
- Create (fixture): `<throwaway-project>/.pi/daddy/workflows/scout.yaml`

- [ ] **Step 1: Author an llm-node fixture with a structured output**

```yaml
name: scout
vsm:
  - sipoc: discovery
    nodes:
      - id: find
        action: llm
        aiAssisted: true
        provider: github-copilot
        model: claude-sonnet-4.6
        variant: low
        instructions: "You are a scout. Report only file:line ranges."
        prompt: "List two source files in this repo. CONTEXT: $ARGUMENTS"
        output_schema:
          type: object
          properties: { ranges: { type: array, items: { type: string } } }
          required: [ranges]
        depends_on: []
```

- [ ] **Step 2: Run it**

Type `--daddy-workflow scout the auth module`.
Expected:
- An isolated child pi spawns (`DADDY_NODE=1`) and the main conversation does NOT grow with the child's reasoning (token isolation).
- The child calls `append_node`; if its `structured` omits `ranges`, the tool throws and the child retries (up to 5), otherwise commits and terminates.
- `find` ends `ok` with `output` set and `structured.ranges` present in `scout.daddy.json`.

- [ ] **Step 3: Verify the retry cap** — temporarily set an impossible schema (e.g. require a field the model cannot know) and confirm the node ends `failed` after 5 attempts rather than looping forever.

---

### Task 29: Manual verification — AI-ask delegation (Phase 2 control flow)

**Files:**
- Create (fixture): `<throwaway-project>/.pi/daddy/workflows/clarify.yaml`

- [ ] **Step 1: Author an AI-ask fixture feeding an llm node**

```yaml
name: clarify
vsm:
  - sipoc: discovery
    nodes:
      - { id: scope, action: ask, aiAssisted: true, prompt: "Clarify the auth scope before scouting.", depends_on: [] }
      - id: scout
        action: llm
        aiAssisted: true
        provider: github-copilot
        model: claude-sonnet-4.6
        variant: low
        instructions: "Scout. file:line only."
        prompt: "Find the relevant code. DECISIONS: $scope.output"
        depends_on: [scope]
```

- [ ] **Step 2: Run it**

Type `--daddy-workflow clarify`.
Expected:
- The run reaches `scope`, marks it `running`, persists, and SUSPENDS — your model/tools switch and the main agent starts an `ask_user_question` loop with assumptions + a `proceed` option.
- The `pi.on("context")` filter trims the window to messages after the marker (the main conversation does not carry prior chatter into this delegation).
- When you select `proceed` (or the model is done), `agent_end` captures the agreed text as `scope.output`, restores your model/tools, persists, and resumes — `scout` then runs as an isolated child and receives only `$scope.output`.

- [ ] **Step 3: Verify suspend/resume survives interruption** — start `clarify`, answer the first ask round, then cancel the turn. Re-run `--daddy-workflow clarify`: expected it resumes from the on-disk state, resetting the still-`running` `scope` to `pending` and re-running it from the start (node is atomic, design §12.2).

- [ ] **Step 4: Final full check**

Run: `cd agent/extensions/daddy && bun test && bun run typecheck`
Expected: all suites PASS, clean typecheck.

```bash
git add -A agent/extensions/daddy
git commit -m "test(daddy): manual verification fixtures and notes"
```

---

## Self-review (run against the design with fresh eyes)

**Spec coverage check (design §-by-§):**
- §2 two axes (action × aiAssisted): `types.ts` Action + aiAssisted; enforced in `validate.ts` (`AI_OK`). ✓
- §5 architecture (flag interception, child branch, agent_end, context, panel): `index.ts` Task 23. ✓
- §6.1 YAML model: `load-workflow.ts` + `types.ts`. ✓ §6.2 state machine: `state-store.ts`. ✓
- §7 context economy ($refs): `resolve-refs.ts`; llm node injects only named refs (Task 18). ✓
- §8 append_node gate (validate, retry cap, terminate, custom message): `append-tool.ts` Task 17. ✓
- §9 wave driver + AI-ask barrier + suspend/resume: `driver.ts` Task 12 + `index.ts` agent_end. ✓
- §10 per-action execution: Tasks 13,15,18,19,21. ✓
- §11 validation rules: `validate.ts` Task 8 (all seven families + name + ref ancestry). ✓
- §12 persistence/resume/flag surface: `state-store.ts`, `session-path.ts`, `start-run.ts` (resume, fresh, concurrent guard, atomic write). ✓
- §13 panel (design + run): Tasks 25–26. ✓
- §14 module layout: file structure matches. ✓
- §15 testing strategy: tests for driver, validate, resolve-refs, state-store, editor, append-tool, schema-compile, load-workflow. ✓
- §16 phasing: Phase 1 = Milestones A–C + run panel; Phase 2 = Milestone D + design editor. Both included per "todo todo". ✓

**Type consistency:** `NodeResult` (`{status:"ok"|"failed", output, structured?}`) is produced by every executor and consumed by `mergeNodeResult`; `partitionReady` returns `{toSkip, subprocess, aiAsk, done}` consumed by `continueRun`; `StateMachine`/`NodeState` shared everywhere. Names align across tasks. ✓

**Known implementation-time corrections flagged inline (not placeholders — explicit, located, with the fix):**
1. `index.ts` `agent_end`: use an object-based `lastAssistantText(messages)` copied from `dev-pipeline/index.ts:282-296`, NOT the line-based stdout parser (Task 23 correction).
2. `run-llm-node.ts`: pass `DADDY_NODE_ID` + `DADDY_NODE_SCHEMA` env to the child (Task 23 child-env contract).
3. `panel/trigger.ts`: `onTerminalInput` is on `ctx`, not `pi` — capture `ctx` from an event and mirror `subagent/panel/trigger.ts` exactly (Task 25 VERIFY).
4. `json-stream.ts` `lastCustomMessage`: confirm the custom-message shape in the real `--mode json` stream before relying on it (Task 14 VERIFY).
5. `schema-compile.ts`: confirm TypeBox v1.1.38 `Value.Check`/`Value.Errors` import path via ctx7 (Task 16 VERIFY).
6. `lib/gate.ts` `editorIsEmpty`: copy `subagent/lib/gate.ts`'s real buffer check; the `hasUI` line is a typecheck placeholder (Task 22 VERIFY).
7. `run-flag-node.ts`: generalize custom-message capture beyond `hello-world` (Task 15 VERIFY).

These are genuine SDK-shape unknowns that MUST be confirmed against source/ctx7 at implementation time (per the anti-hallucination rules); each names the exact file, the exact check, and the exact fix.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-daddy-extension.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
