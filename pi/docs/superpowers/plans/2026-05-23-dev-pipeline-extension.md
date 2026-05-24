# `dev-pipeline` pi Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained pi.dev extension that runs a deterministic dev-pipeline state machine (Context → Brainstorm → Spec → Plan → Implement → Review → Notes) where the TypeScript orchestrates and the LLM only creates, with file-based handoffs and zero JSON-parse control flow.

**Architecture:** A pure `transition()` reducer drives all phase changes (0 LLM tokens). Deterministic context gathering runs via `pi.exec`. Each creative phase is driven by a generic `runPhase` helper that sets the model + scoped tools, filters context to be fresh, injects a prompt that instructs the LLM to `write` a markdown artifact, and on `agent_end` validates the file exists/non-empty before advancing. State is persisted via `pi.appendEntry` after every transition and restored on `session_start`. No commits, no branches, no worktrees (per design §9).

**Tech Stack:** TypeScript (ESNext, bundler resolution, strict), `@earendil-works/pi-coding-agent@0.75.4`, `@earendil-works/pi-tui@0.75.4`, `bun test` for unit tests. Runtime: pi coding agent, auto-discovered via `~/.pi/agent/extensions/`.

**Verified API surface (all confirmed against the installed package's `dist/**/*.d.ts`, `docs/extensions.md`, and `examples/`):**

| API | Signature | Source |
|---|---|---|
| `pi.on("input", h)` | `event.text:string`, `event.source:"interactive"\|"rpc"\|"extension"`; returns `{action:"continue"}\|{action:"transform",text,images?}\|{action:"handled"}` | `types.d.ts:567-575`; `examples/.../input-transform.ts` |
| `pi.registerFlag` | `(name, {description?, type:"boolean"\|"string", default?})` ; `pi.getFlag(name)` | `types.d.ts:822-829` |
| `pi.registerCommand` | `(name, {description, handler:(args:string, ctx)=>Promise<void>})` | `types.d.ts:815-816` |
| `pi.on("agent_end", h)` | `event.messages: AgentMessage[]` | `types.d.ts:484-486` |
| `pi.on("turn_end", h)` | `event.turnIndex, event.message, event.toolResults` | `types.d.ts:495-500` |
| `pi.on("context", h)` | `event.messages` (deep copy); return `{messages?}` | `types.d.ts:452-455` |
| `pi.on("session_start", h)` | `event.reason:"startup"\|"reload"\|"new"\|"resume"\|"fork"` | `types.d.ts:382-388,785` |
| `pi.sendUserMessage` | `(content, {deliverAs?:"steer"\|"followUp"})` — triggers a turn | `types.d.ts:841-843` |
| `pi.sendMessage` | `({customType, content, display}, {triggerTurn?:boolean})` | `examples/.../plan-mode/index.ts:225` |
| `pi.setModel` | `(model: Model<any>) => Promise<boolean>` (false if no API key) | `types.d.ts:862-863` |
| `ctx.modelRegistry.find` | `(provider, modelId) => Model\|undefined`; current: `ctx.model` | `types.d.ts:216-219` |
| `pi.setActiveTools` / `getActiveTools` / `getAllTools` | `(string[])` / `()=>string[]` / `()=>ToolInfo[]` ; built-ins `read,bash,edit,write,grep,find,ls` | `types.d.ts:854-859`; `extensions.md:1483-1500` |
| `pi.appendEntry` | `<T>(customType:string, data?:T)` | `types.d.ts:844-845` |
| `ctx.sessionManager.getBranch` | `(fromId?) => SessionEntry[]` (current branch) | `session-manager.d.ts:244` |
| `ctx.sessionManager.getEntries` | `() => SessionEntry[]` (all entries) | `session-manager.d.ts:259` |
| custom entry shape | `{type:"custom", customType:string, data?:T}` | `extensions.md:1329` |
| `pi.exec` | `(command, args, {timeout?}) => Promise<{code,stdout,stderr}>` | `types.d.ts:852-853` |
| `ctx.ui.select` | `(title, options:string[], opts?) => Promise<string\|undefined>` | `types.d.ts:69` |
| `ctx.ui.confirm` | `(title, message, opts?) => Promise<boolean>` | `types.d.ts:71` |
| `ctx.ui.input` | `(title, placeholder?, opts?) => Promise<string\|undefined>` | `types.d.ts:73` |
| `ctx.ui.editor` | `(title, prefill?) => Promise<string\|undefined>` | `types.d.ts:134` |
| `ctx.ui.custom<T>` | `(factory:(tui, theme, kb, done)=>Component&{dispose?}, options?) => Promise<T>` | `types.d.ts:124` |
| `ctx.ui.setStatus` / `notify` | `(key, text\|undefined)` / `(msg, "info"\|"warning"\|"error")` | `types.d.ts:79,75` |
| `ctx.hasUI` | `boolean` (false in print/rpc) | `types.d.ts:211` |
| `estimateTokens` | exported helper for token counting | `index.d.ts:4` |
| entry point | `export default function (pi: ExtensionAPI): void` | `examples/.../plan-mode/index.ts:38`; `gemini/index.ts` |

**Design decision locked in (user-confirmed 2026-05-23):** The Brainstorm question form uses the rich `ctx.ui.custom` TUI component (design §7.1), modeled on `examples/extensions/questionnaire.ts`, with each question's default pre-selected plus a free-text refute/comments field. (This overrides the NFR-10 "defer rich TUI" note for the brainstorm form specifically; approval gates remain simple text dialogs.)

**Global conventions for every task:**
- Module path root: `agent/extensions/dev-pipeline/`.
- All imports of pi types come from `@earendil-works/pi-coding-agent`; TUI primitives from `@earendil-works/pi-tui`. No other runtime deps.
- Tests run with `bun test` from `agent/extensions/dev-pipeline/`.
- Match `gemini`'s style: ESM, `type: "module"`, tabs for indentation, named `register*`-style helpers, small focused files.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Package manifest; `pi.extensions:["./index.ts"]`; deps; `test` script. |
| `tsconfig.json` | ESNext/bundler/strict (copied from `gemini`). |
| `README.md` | Setup, usage, smoke test instructions. |
| `index.ts` | Wiring only: flag, command, and `on(input/agent_end/context/turn_end/session_start)`. |
| `state.ts` | `Phase`, `PipelineState`, `createInitialState()`, pure `transition()`. |
| `orchestrator.ts` | Model/tool switching, persistence, context-filtering, `runPhase`, restore. |
| `lib/paths.ts` | Artifact-folder mangling, slug sanitization, date stamp, artifact paths. |
| `lib/models.ts` | Model IDs + per-phase tool scoping constants. |
| `lib/prompts.ts` | Per-phase prompt builders. |
| `lib/questions.ts` | Parse `Q:/DEFAULT:/WHY:` question blocks (with 0-question fallback). |
| `context/gather.ts` | eza tree + stack detection + tool probes via injected `exec`. |
| `context/compress.ts` | Compress gathered context to ≤~2K tokens / ~8K char cap. |
| `phases/brainstorm.ts` | Question loop: drive LLM, render form, collect decisions. |
| `phases/spec.ts` | Spec write + self-review + approval gate. |
| `phases/plan.ts` | Research-decision → deterministic research → plan author + review + gate. |
| `phases/implement.ts` | Per-task TDD loop with deterministic test verification; BLOCKED report. |
| `phases/review.ts` | Final review from `git diff`; verdict. |
| `phases/notes.ts` | Implementation notes artifact. |
| `ui/questions-form.ts` | `ctx.ui.custom` TUI form (defaults + refute field + fallback). |
| `ui/approval-gate.ts` | approve / reject-with-feedback text gate. |
| `tests/*.test.ts` | bun unit tests for the deterministic/pure pieces. |

---

## Task 0: Package scaffold

**Files:**
- Create: `agent/extensions/dev-pipeline/package.json`
- Create: `agent/extensions/dev-pipeline/tsconfig.json`
- Create: `agent/extensions/dev-pipeline/tests/smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
	"name": "pi-dev-pipeline",
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
		"@earendil-works/pi-tui": "0.75.4"
	},
	"devDependencies": {
		"typescript": "^5.6.0",
		"@types/node": "^22.0.0"
	}
}
```

- [ ] **Step 2: Create `tsconfig.json`** (verbatim copy of `gemini/tsconfig.json`)

```json
{
	"compilerOptions": {
		"target": "ESNext",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"strict": true,
		"skipLibCheck": true,
		"noEmit": true,
		"esModuleInterop": true,
		"verbatimModuleSyntax": true,
		"lib": ["ESNext", "DOM"],
		"types": ["node"]
	},
	"include": ["**/*.ts"],
	"exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write a trivial smoke test so the runner is wired**

`tests/smoke.test.ts`:

```ts
import { expect, test } from "bun:test";

test("test runner is wired", () => {
	expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Install deps and verify the runner**

Run: `cd agent/extensions/dev-pipeline && bun install && bun test`
Expected: install succeeds; `1 test passed`.

- [ ] **Step 5: Commit-free checkpoint** (this repo's pipeline never auto-commits; the user commits manually). Just confirm `bun test` is green before continuing.

---

## Task 1: `lib/paths.ts` — artifact folder + slug (FR-5, FR-14)

**Files:**
- Create: `agent/extensions/dev-pipeline/lib/paths.ts`
- Test: `agent/extensions/dev-pipeline/tests/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/paths.test.ts`:

```ts
import { expect, test } from "bun:test";
import { artifactFolderFor, sanitizeSlug, dateStamp, artifactPath } from "../lib/paths.ts";

test("artifactFolderFor strips /Users/ and maps / to _", () => {
	const folder = artifactFolderFor("/Users/hugoruiz/work/Developer/x", "/Users/hugoruiz/obsidian-home");
	expect(folder).toBe("/Users/hugoruiz/obsidian-home/obsidian/Documents/hugoruiz_work_Developer_x");
});

test("artifactFolderFor handles cwd not under /Users", () => {
	const folder = artifactFolderFor("/srv/repo", "/home/me");
	expect(folder).toBe("/home/me/obsidian/Documents/srv_repo");
});

test("sanitizeSlug lowercases and keeps only [a-z0-9-]", () => {
	expect(sanitizeSlug("My Cool Feature!! v2")).toBe("my-cool-feature-v2");
	expect(sanitizeSlug("  Leading/Trailing  ")).toBe("leading-trailing");
	expect(sanitizeSlug("__weird___name__")).toBe("weird-name");
});

test("sanitizeSlug falls back to 'feature' when empty", () => {
	expect(sanitizeSlug("!!!")).toBe("feature");
});

test("dateStamp returns YYYY-MM-DD", () => {
	expect(dateStamp(new Date("2026-05-23T10:00:00Z"))).toBe("2026-05-23");
});

test("artifactPath joins folder/date-slug-type.md", () => {
	expect(artifactPath("/a/b", "2026-05-23", "my-feature", "design")).toBe(
		"/a/b/2026-05-23-my-feature-design.md",
	);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd agent/extensions/dev-pipeline && bun test tests/paths.test.ts`
Expected: FAIL — `Cannot find module '../lib/paths.ts'`.

- [ ] **Step 3: Implement `lib/paths.ts`**

```ts
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * FR-5: ~/obsidian/Documents/<abs-cwd with leading "/Users/" removed and "/"→"_">.
 * `home` is injectable for testing; defaults to the real home dir.
 */
export function artifactFolderFor(cwd: string, home: string = homedir()): string {
	const stripped = cwd.replace(/^\/Users\//, "").replace(/^\//, "");
	const mangled = stripped.replace(/\//g, "_");
	return join(home, "obsidian", "Documents", mangled);
}

/** FR-14: kebab-case, sanitized to [a-z0-9-]+; never empty. */
export function sanitizeSlug(raw: string): string {
	const slug = raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "feature";
}

export function dateStamp(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

export function artifactPath(folder: string, date: string, slug: string, type: string): string {
	return join(folder, `${date}-${slug}-${type}.md`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd agent/extensions/dev-pipeline && bun test tests/paths.test.ts`
Expected: PASS — 6 tests.

---

## Task 2: `state.ts` — state machine (FR-2, NFR-1)

**Files:**
- Create: `agent/extensions/dev-pipeline/state.ts`
- Test: `agent/extensions/dev-pipeline/tests/state.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/state.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createInitialState, transition, type PipelineState } from "../state.ts";

function start(): PipelineState {
	return createInitialState("add dark mode");
}

test("createInitialState begins IDLE with the activity", () => {
	const s = start();
	expect(s.phase).toBe("IDLE");
	expect(s.activity).toBe("add dark mode");
	expect(s.questionRound).toBe(0);
	expect(s.gateAttempts).toBe(0);
});

test("START moves IDLE -> GATHERING_CONTEXT", () => {
	const s = transition(start(), { type: "START" });
	expect(s.phase).toBe("GATHERING_CONTEXT");
});

test("CONTEXT_READY stores context and moves to BRAINSTORM", () => {
	let s = transition(start(), { type: "START" });
	s = transition(s, { type: "CONTEXT_READY", compressedContext: "ctx", artifactFolder: "/f" });
	expect(s.phase).toBe("BRAINSTORM");
	expect(s.compressedContext).toBe("ctx");
	expect(s.artifactFolder).toBe("/f");
});

test("out-of-order events return state unchanged", () => {
	const s = start(); // IDLE
	const after = transition(s, { type: "CONTEXT_READY", compressedContext: "x", artifactFolder: "/f" });
	expect(after).toEqual(s);
});

test("brainstorm round increments and PROCEED advances to SPEC", () => {
	let s = transition(transition(start(), { type: "START" }), {
		type: "CONTEXT_READY",
		compressedContext: "c",
		artifactFolder: "/f",
	});
	s = transition(s, { type: "QUESTION_ROUND" });
	expect(s.questionRound).toBe(1);
	s = transition(s, { type: "PROCEED", decisions: "agreed", slug: "dark-mode" });
	expect(s.phase).toBe("SPEC");
	expect(s.decisions).toBe("agreed");
	expect(s.slug).toBe("dark-mode");
});

test("spec write -> self review -> gate -> approve advances to PLAN_RESEARCH", () => {
	let s = bringTo(start(), "SPEC");
	s = transition(s, { type: "SPEC_WRITTEN", specPath: "/f/d.md" });
	expect(s.phase).toBe("SPEC_SELF_REVIEW");
	expect(s.specPath).toBe("/f/d.md");
	s = transition(s, { type: "REVIEWED" });
	expect(s.phase).toBe("SPEC_GATE");
	s = transition(s, { type: "APPROVED" });
	expect(s.phase).toBe("PLAN_RESEARCH");
});

test("spec gate reject bumps attempts and returns to SPEC", () => {
	let s = bringTo(start(), "SPEC_GATE");
	s = transition(s, { type: "REJECT", feedback: "too vague" });
	expect(s.phase).toBe("SPEC");
	expect(s.gateAttempts).toBe(1);
});

test("plan flow research -> author -> review -> gate -> approve -> IMPLEMENT", () => {
	let s = bringTo(start(), "PLAN_RESEARCH");
	s = transition(s, { type: "RESEARCH_DECIDED" });
	expect(s.phase).toBe("PLAN_AUTHOR");
	s = transition(s, { type: "PLAN_WRITTEN", planPath: "/f/p.md", tasks: [{ id: 1, title: "t1", status: "pending" }] });
	expect(s.phase).toBe("PLAN_SELF_REVIEW");
	expect(s.tasks.length).toBe(1);
	s = transition(s, { type: "REVIEWED" });
	expect(s.phase).toBe("PLAN_GATE");
	s = transition(s, { type: "APPROVED" });
	expect(s.phase).toBe("IMPLEMENT");
});

test("implement task done advances index; ALL_TASKS_DONE -> REVIEW", () => {
	let s = bringTo(start(), "IMPLEMENT");
	s.tasks = [
		{ id: 1, title: "a", status: "pending" },
		{ id: 2, title: "b", status: "pending" },
	];
	s = transition(s, { type: "TASK_DONE" });
	expect(s.tasks[0].status).toBe("done");
	expect(s.currentTaskIndex).toBe(1);
	expect(s.phase).toBe("IMPLEMENT");
	s = transition(s, { type: "TASK_DONE" });
	expect(s.tasks[1].status).toBe("done");
	s = transition(s, { type: "ALL_TASKS_DONE" });
	expect(s.phase).toBe("REVIEW");
});

test("BLOCKED from IMPLEMENT marks the task and halts", () => {
	let s = bringTo(start(), "IMPLEMENT");
	s.tasks = [{ id: 1, title: "a", status: "pending" }];
	s = transition(s, { type: "BLOCKED" });
	expect(s.phase).toBe("BLOCKED");
	expect(s.tasks[0].status).toBe("blocked");
});

test("REVIEW -> NOTES -> COMPLETE", () => {
	let s = bringTo(start(), "REVIEW");
	s = transition(s, { type: "REVIEWED_CODE", verdict: "APPROVED" });
	expect(s.phase).toBe("NOTES");
	expect(s.reviewVerdict).toBe("APPROVED");
	s = transition(s, { type: "NOTES_WRITTEN", notesPath: "/f/i.md" });
	expect(s.phase).toBe("COMPLETE");
	expect(s.notesPath).toBe("/f/i.md");
});

test("RESET returns to IDLE from any phase", () => {
	const s = transition(bringTo(start(), "IMPLEMENT"), { type: "RESET" });
	expect(s.phase).toBe("IDLE");
});

// Helper: drive the machine through the happy path up to a target phase.
function bringTo(s: PipelineState, target: PipelineState["phase"]): PipelineState {
	const steps: { ev: Parameters<typeof transition>[1]; reach: PipelineState["phase"] }[] = [
		{ ev: { type: "START" }, reach: "GATHERING_CONTEXT" },
		{ ev: { type: "CONTEXT_READY", compressedContext: "c", artifactFolder: "/f" }, reach: "BRAINSTORM" },
		{ ev: { type: "PROCEED", decisions: "d", slug: "s" }, reach: "SPEC" },
		{ ev: { type: "SPEC_WRITTEN", specPath: "/f/d.md" }, reach: "SPEC_SELF_REVIEW" },
		{ ev: { type: "REVIEWED" }, reach: "SPEC_GATE" },
		{ ev: { type: "APPROVED" }, reach: "PLAN_RESEARCH" },
		{ ev: { type: "RESEARCH_DECIDED" }, reach: "PLAN_AUTHOR" },
		{ ev: { type: "PLAN_WRITTEN", planPath: "/f/p.md", tasks: [{ id: 1, title: "t", status: "pending" }] }, reach: "PLAN_SELF_REVIEW" },
		{ ev: { type: "REVIEWED" }, reach: "PLAN_GATE" },
		{ ev: { type: "APPROVED" }, reach: "IMPLEMENT" },
		{ ev: { type: "ALL_TASKS_DONE" }, reach: "REVIEW" },
	];
	let cur = s;
	for (const step of steps) {
		cur = transition(cur, step.ev);
		if (cur.phase === target) return cur;
	}
	return cur;
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd agent/extensions/dev-pipeline && bun test tests/state.test.ts`
Expected: FAIL — `Cannot find module '../state.ts'`.

- [ ] **Step 3: Implement `state.ts`**

```ts
export type Phase =
	| "IDLE"
	| "GATHERING_CONTEXT"
	| "BRAINSTORM"
	| "SPEC"
	| "SPEC_SELF_REVIEW"
	| "SPEC_GATE"
	| "PLAN_RESEARCH"
	| "PLAN_AUTHOR"
	| "PLAN_SELF_REVIEW"
	| "PLAN_GATE"
	| "IMPLEMENT"
	| "REVIEW"
	| "NOTES"
	| "COMPLETE"
	| "BLOCKED";

export interface Task {
	id: number;
	title: string;
	status: "pending" | "done" | "blocked";
}

export interface PipelineState {
	phase: Phase;
	activity: string;
	artifactFolder: string | null;
	slug: string | null;
	compressedContext: string;
	decisions: string;
	questionRound: number;
	specPath: string | null;
	planPath: string | null;
	tasks: Task[];
	currentTaskIndex: number;
	reviewVerdict: "APPROVED" | "CHANGES_REQUIRED" | null;
	notesPath: string | null;
	originalModel: { provider: string; id: string } | null;
	allToolNames: string[];
	gateAttempts: number;
}

export type PipelineEvent =
	| { type: "START" }
	| { type: "CONTEXT_READY"; compressedContext: string; artifactFolder: string }
	| { type: "QUESTION_ROUND" }
	| { type: "PROCEED"; decisions: string; slug: string }
	| { type: "SPEC_WRITTEN"; specPath: string }
	| { type: "REVIEWED" }
	| { type: "APPROVED" }
	| { type: "REJECT"; feedback: string }
	| { type: "RESEARCH_DECIDED" }
	| { type: "PLAN_WRITTEN"; planPath: string; tasks: Task[] }
	| { type: "TASK_DONE" }
	| { type: "ALL_TASKS_DONE" }
	| { type: "BLOCKED" }
	| { type: "REVIEWED_CODE"; verdict: "APPROVED" | "CHANGES_REQUIRED" }
	| { type: "NOTES_WRITTEN"; notesPath: string }
	| { type: "RESET" };

export function createInitialState(activity: string): PipelineState {
	return {
		phase: "IDLE",
		activity,
		artifactFolder: null,
		slug: null,
		compressedContext: "",
		decisions: "",
		questionRound: 0,
		specPath: null,
		planPath: null,
		tasks: [],
		currentTaskIndex: 0,
		reviewVerdict: null,
		notesPath: null,
		originalModel: null,
		allToolNames: [],
		gateAttempts: 0,
	};
}

/**
 * Pure reducer. Every transition is guarded by the current phase; an event that
 * does not match the phase returns the state unchanged (0 LLM tokens, FR-2/NFR-1).
 * RESET is honored from any phase.
 */
export function transition(state: PipelineState, event: PipelineEvent): PipelineState {
	if (event.type === "RESET") {
		return { ...state, phase: "IDLE" };
	}

	switch (state.phase) {
		case "IDLE":
			if (event.type === "START") return { ...state, phase: "GATHERING_CONTEXT" };
			return state;

		case "GATHERING_CONTEXT":
			if (event.type === "CONTEXT_READY")
				return {
					...state,
					phase: "BRAINSTORM",
					compressedContext: event.compressedContext,
					artifactFolder: event.artifactFolder,
				};
			return state;

		case "BRAINSTORM":
			if (event.type === "QUESTION_ROUND") return { ...state, questionRound: state.questionRound + 1 };
			if (event.type === "PROCEED")
				return { ...state, phase: "SPEC", decisions: event.decisions, slug: event.slug };
			return state;

		case "SPEC":
			if (event.type === "SPEC_WRITTEN")
				return { ...state, phase: "SPEC_SELF_REVIEW", specPath: event.specPath };
			return state;

		case "SPEC_SELF_REVIEW":
			if (event.type === "REVIEWED") return { ...state, phase: "SPEC_GATE" };
			return state;

		case "SPEC_GATE":
			if (event.type === "APPROVED") return { ...state, phase: "PLAN_RESEARCH" };
			if (event.type === "REJECT") return { ...state, phase: "SPEC", gateAttempts: state.gateAttempts + 1 };
			return state;

		case "PLAN_RESEARCH":
			if (event.type === "RESEARCH_DECIDED") return { ...state, phase: "PLAN_AUTHOR" };
			return state;

		case "PLAN_AUTHOR":
			if (event.type === "PLAN_WRITTEN")
				return { ...state, phase: "PLAN_SELF_REVIEW", planPath: event.planPath, tasks: event.tasks };
			return state;

		case "PLAN_SELF_REVIEW":
			if (event.type === "REVIEWED") return { ...state, phase: "PLAN_GATE" };
			return state;

		case "PLAN_GATE":
			if (event.type === "APPROVED") return { ...state, phase: "IMPLEMENT", currentTaskIndex: 0 };
			if (event.type === "REJECT")
				return { ...state, phase: "PLAN_AUTHOR", gateAttempts: state.gateAttempts + 1 };
			return state;

		case "IMPLEMENT":
			if (event.type === "TASK_DONE") {
				const tasks = state.tasks.map((t, i) =>
					i === state.currentTaskIndex ? { ...t, status: "done" as const } : t,
				);
				return { ...state, tasks, currentTaskIndex: state.currentTaskIndex + 1 };
			}
			if (event.type === "BLOCKED") {
				const tasks = state.tasks.map((t, i) =>
					i === state.currentTaskIndex ? { ...t, status: "blocked" as const } : t,
				);
				return { ...state, phase: "BLOCKED", tasks };
			}
			if (event.type === "ALL_TASKS_DONE") return { ...state, phase: "REVIEW" };
			return state;

		case "REVIEW":
			if (event.type === "REVIEWED_CODE")
				return { ...state, phase: "NOTES", reviewVerdict: event.verdict };
			return state;

		case "NOTES":
			if (event.type === "NOTES_WRITTEN")
				return { ...state, phase: "COMPLETE", notesPath: event.notesPath };
			return state;

		default:
			return state;
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd agent/extensions/dev-pipeline && bun test tests/state.test.ts`
Expected: PASS — all transition tests green.

---

## Task 3: `context/compress.ts` — token-bounded compression (FR-9, NFR-1)

**Files:**
- Create: `agent/extensions/dev-pipeline/context/compress.ts`
- Test: `agent/extensions/dev-pipeline/tests/compress.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/compress.test.ts`:

```ts
import { expect, test } from "bun:test";
import { compressContext, MAX_CONTEXT_CHARS } from "../context/compress.ts";

test("short content passes through unchanged", () => {
	const out = compressContext({ tree: "a\nb", stack: "deps: x", probes: "ast_grep=false graphify=false" });
	expect(out).toContain("a\nb");
	expect(out).toContain("deps: x");
	expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
});

test("oversized content is truncated to the char cap with a marker", () => {
	const huge = "x".repeat(MAX_CONTEXT_CHARS * 2);
	const out = compressContext({ tree: huge, stack: "deps: y", probes: "p" });
	expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
	expect(out).toContain("[truncated]");
	// Highest-priority sections (stack, probes) survive truncation.
	expect(out).toContain("deps: y");
	expect(out).toContain("p");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd agent/extensions/dev-pipeline && bun test tests/compress.test.ts`
Expected: FAIL — `Cannot find module '../context/compress.ts'`.

- [ ] **Step 3: Implement `context/compress.ts`**

```ts
import { estimateTokens } from "@earendil-works/pi-coding-agent";

/** FR-9: ≤ ~2,000 tokens; hard char cap ~8K as a backstop. */
export const MAX_CONTEXT_TOKENS = 2000;
export const MAX_CONTEXT_CHARS = 8000;

export interface ContextParts {
	stack: string;
	probes: string;
	tree: string;
}

/**
 * Compose the deterministic context into a single block, bounded to the budget.
 * Stack + probes are the cheapest, highest-signal sections and are kept whole;
 * the file tree is the large, lower-priority section and is truncated first.
 */
export function compressContext(parts: ContextParts): string {
	const header = [`## Stack\n${parts.stack}`, `## Tooling\n${parts.probes}`].join("\n\n");
	const treeHeader = "## Project tree\n";

	// Budget for the tree = whatever remains under the char cap after the header.
	const reserved = header.length + treeHeader.length + 4;
	let tree = parts.tree;
	const treeBudget = MAX_CONTEXT_CHARS - reserved;
	if (tree.length > treeBudget) {
		tree = `${tree.slice(0, Math.max(0, treeBudget - "\n[truncated]".length))}\n[truncated]`;
	}

	let out = `${header}\n\n${treeHeader}${tree}`;

	// Token backstop: if still over the token budget, trim the tree further.
	while (estimateTokens(out) > MAX_CONTEXT_TOKENS && tree.length > 0) {
		tree = `${tree.slice(0, Math.floor(tree.length * 0.8))}\n[truncated]`;
		out = `${header}\n\n${treeHeader}${tree}`;
	}

	return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd agent/extensions/dev-pipeline && bun test tests/compress.test.ts`
Expected: PASS — 2 tests.

---

## Task 4: `context/gather.ts` — deterministic context (FR-6, FR-7, FR-8)

**Files:**
- Create: `agent/extensions/dev-pipeline/context/gather.ts`
- Test: `agent/extensions/dev-pipeline/tests/gather.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/gather.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseStack, EXCLUDE_DIRS, gatherContext, type ExecFn } from "../context/gather.ts";

test("parseStack reduces package.json to name + dep + script names only", () => {
	const pkg = JSON.stringify({
		name: "demo",
		version: "1.0.0",
		dependencies: { react: "^18", zod: "^3" },
		devDependencies: { typescript: "^5" },
		scripts: { build: "tsc", test: "vitest" },
	});
	const out = parseStack("package.json", pkg);
	expect(out).toContain("demo");
	expect(out).toContain("react");
	expect(out).toContain("zod");
	expect(out).toContain("typescript");
	expect(out).toContain("build");
	expect(out).toContain("test");
	// No version strings leak through.
	expect(out).not.toContain("^18");
	expect(out).not.toContain("vitest"); // script *values* are dropped; only names kept
});

test("parseStack handles unknown manifest by emitting just its name", () => {
	expect(parseStack("go.mod", "module example.com/x\n")).toContain("go.mod");
});

test("EXCLUDE_DIRS contains the required exclusions", () => {
	for (const d of ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "target", ".venv", "coverage"]) {
		expect(EXCLUDE_DIRS).toContain(d);
	}
});

test("gatherContext probes ast-grep and graphify and never throws on missing tools", async () => {
	const exec: ExecFn = async (cmd, args) => {
		if (cmd === "eza") return { code: 0, stdout: "src\n  index.ts", stderr: "" };
		if (cmd === "which" && args[0] === "ast-grep") return { code: 1, stdout: "", stderr: "" }; // absent
		if (cmd === "test") return { code: 1, stdout: "", stderr: "" }; // graphify-out absent
		if (cmd === "cat") return { code: 0, stdout: JSON.stringify({ name: "demo", dependencies: { a: "1" } }), stderr: "" };
		if (cmd === "ls") return { code: 0, stdout: "package.json", stderr: "" };
		return { code: 1, stdout: "", stderr: "" };
	};
	const result = await gatherContext(exec, "/repo");
	expect(result.probes).toContain("ast_grep=false");
	expect(result.probes).toContain("graphify=false");
	expect(result.tree).toContain("src");
	expect(result.stack).toContain("demo");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd agent/extensions/dev-pipeline && bun test tests/gather.test.ts`
Expected: FAIL — `Cannot find module '../context/gather.ts'`.

- [ ] **Step 3: Implement `context/gather.ts`**

```ts
export type ExecFn = (
	command: string,
	args: string[],
	options?: { timeout?: number },
) => Promise<{ code: number; stdout: string; stderr: string }>;

/** FR-6 exclusions. */
export const EXCLUDE_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"__pycache__",
	"target",
	".venv",
	"coverage",
];

const MANIFESTS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "Gemfile"];

export interface GatheredContext {
	tree: string;
	stack: string;
	probes: string;
	astGrep: boolean;
	graphify: boolean;
}

/**
 * FR-7: reduce a manifest to compressed signal only.
 * package.json → name + dependency names + script names (never versions/values).
 * Other manifests → just the filename marker (full parsing out of scope for v1).
 */
export function parseStack(manifest: string, content: string): string {
	if (manifest === "package.json") {
		try {
			const pkg = JSON.parse(content) as {
				name?: string;
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
				scripts?: Record<string, string>;
			};
			const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
			const scripts = Object.keys(pkg.scripts ?? {});
			return [
				`package.json: ${pkg.name ?? "(unnamed)"}`,
				deps.length ? `deps: ${deps.join(", ")}` : "deps: (none)",
				scripts.length ? `scripts: ${scripts.join(", ")}` : "scripts: (none)",
			].join("\n");
		} catch {
			return "package.json: (unparseable)";
		}
	}
	return `${manifest}: present`;
}

function buildTreeArgs(): string[] {
	const args = ["--tree", "--level=3"];
	for (const dir of EXCLUDE_DIRS) {
		args.push("--ignore-glob", dir);
	}
	return args;
}

/** All probes are best-effort: a non-zero exit means "absent", never an error (FR-8/FR-18). */
export async function gatherContext(exec: ExecFn, cwd: string): Promise<GatheredContext> {
	// FR-6 tree
	let tree = "";
	try {
		const r = await exec("eza", buildTreeArgs(), { timeout: 15000 });
		tree = r.code === 0 ? r.stdout.trim() : "(tree unavailable)";
	} catch {
		tree = "(tree unavailable)";
	}

	// FR-7 stack: list manifests present, then compress each.
	const stackParts: string[] = [];
	try {
		const ls = await exec("ls", ["-1", cwd]);
		const present = ls.code === 0 ? ls.stdout.split("\n").map((s) => s.trim()) : [];
		for (const manifest of MANIFESTS) {
			if (!present.includes(manifest)) continue;
			const cat = await exec("cat", [`${cwd}/${manifest}`]);
			stackParts.push(parseStack(manifest, cat.code === 0 ? cat.stdout : ""));
		}
	} catch {
		// leave stackParts empty
	}
	const stack = stackParts.length ? stackParts.join("\n\n") : "(no recognized manifest)";

	// FR-8 probes
	const astGrep = (await safeCode(exec, "which", ["ast-grep"])) === 0;
	const graphify = (await safeCode(exec, "test", ["-d", `${cwd}/graphify-out`])) === 0;
	const probes = `ast_grep=${astGrep} graphify=${graphify}`;

	return { tree, stack, probes, astGrep, graphify };
}

async function safeCode(exec: ExecFn, command: string, args: string[]): Promise<number> {
	try {
		return (await exec(command, args)).code;
	} catch {
		return 1;
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd agent/extensions/dev-pipeline && bun test tests/gather.test.ts`
Expected: PASS — 4 tests.

> Note for the worker: `eza`'s exclude flag is `--ignore-glob` (eza ≥ 0.18). The test injects a fake `exec`, so this is only exercised at runtime; the smoke test in Task 13 verifies real output omits excluded dirs.

---

## Task 5: `lib/questions.ts` — parse question blocks + fallback (FR-30)

**Files:**
- Create: `agent/extensions/dev-pipeline/lib/questions.ts`
- Test: `agent/extensions/dev-pipeline/tests/questions.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/questions.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseQuestions, type ParsedQuestion } from "../lib/questions.ts";

const sample = `Some preamble the model wrote.

Q: Should dark mode follow the OS setting?
DEFAULT: Yes, follow OS with a manual override
WHY: Matches platform conventions and is the least surprising

Q: Where should the toggle live?
DEFAULT: In Settings > Appearance
WHY: Discoverable without cluttering the main nav

Assumptions:
- Using CSS variables for theming (inferable from the stack)`;

test("parseQuestions extracts Q/DEFAULT/WHY blocks", () => {
	const qs = parseQuestions(sample);
	expect(qs.length).toBe(2);
	const first = qs[0] as ParsedQuestion;
	expect(first.prompt).toBe("Should dark mode follow the OS setting?");
	expect(first.default).toBe("Yes, follow OS with a manual override");
	expect(first.why).toContain("platform conventions");
});

test("parseQuestions returns [] when no Q: blocks exist (triggers fallback)", () => {
	expect(parseQuestions("Just prose, no structured questions.")).toEqual([]);
});

test("parseQuestions tolerates a Q without DEFAULT/WHY", () => {
	const qs = parseQuestions("Q: Only a question?\n");
	expect(qs.length).toBe(1);
	expect(qs[0].default).toBe("");
	expect(qs[0].why).toBe("");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd agent/extensions/dev-pipeline && bun test tests/questions.test.ts`
Expected: FAIL — `Cannot find module '../lib/questions.ts'`.

- [ ] **Step 3: Implement `lib/questions.ts`**

```ts
export interface ParsedQuestion {
	id: string;
	prompt: string;
	default: string;
	why: string;
}

/**
 * Parse the strict `Q:/DEFAULT:/WHY:` block format the brainstorm LLM writes.
 * Parsing is for *rendering the UI only* — control flow never depends on it (FR-30).
 * Returns [] when nothing parses, which the caller treats as the raw-content fallback.
 */
export function parseQuestions(md: string): ParsedQuestion[] {
	const lines = md.split("\n");
	const questions: ParsedQuestion[] = [];
	let current: ParsedQuestion | null = null;

	const flush = () => {
		if (current) questions.push(current);
		current = null;
	};

	for (const line of lines) {
		const q = line.match(/^\s*Q:\s*(.*)$/);
		const d = line.match(/^\s*DEFAULT:\s*(.*)$/);
		const w = line.match(/^\s*WHY:\s*(.*)$/);
		if (q) {
			flush();
			current = { id: `q${questions.length + 1}`, prompt: q[1].trim(), default: "", why: "" };
		} else if (d && current) {
			current.default = d[1].trim();
		} else if (w && current) {
			current.why = w[1].trim();
		}
	}
	flush();

	return questions.filter((x) => x.prompt.length > 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd agent/extensions/dev-pipeline && bun test tests/questions.test.ts`
Expected: PASS — 3 tests.

---

## Task 6: `lib/models.ts` — model routing + tool scoping (FR-27, FR-29, NFR-9)

**Files:**
- Create: `agent/extensions/dev-pipeline/lib/models.ts`

This module holds only constants (configurable per NFR-9); no test needed — it is consumed by `orchestrator.ts` and exercised by the smoke path.

- [ ] **Step 1: Implement `lib/models.ts`**

```ts
import type { Phase } from "../state.ts";

/** NFR-9: model IDs in configurable constants. Provider + IDs confirmed in enabledModels. */
export const SONNET = { provider: "github-copilot", id: "claude-sonnet-4.6" } as const;
export const OPUS = { provider: "github-copilot", id: "claude-opus-4.6" } as const;

export type ModelRef = { provider: string; id: string };

/** Read-only built-in tool sets, scoped per phase (FR-29). */
const READ_ONLY = ["read", "grep", "find", "ls"];
const READ_ONLY_BASH = ["read", "grep", "find", "ls", "bash"];
const WRITE_DOCS = ["read", "grep", "find", "ls", "write"];
const IMPLEMENT = ["read", "write", "edit", "bash"];

/** FR-27 + FR-29: the model and active tools for each LLM-driven phase. */
export const PHASE_CONFIG: Partial<Record<Phase, { model: ModelRef; tools: string[] }>> = {
	BRAINSTORM: { model: SONNET, tools: READ_ONLY },
	SPEC: { model: OPUS, tools: WRITE_DOCS },
	SPEC_SELF_REVIEW: { model: OPUS, tools: WRITE_DOCS },
	PLAN_RESEARCH: { model: SONNET, tools: READ_ONLY_BASH },
	PLAN_AUTHOR: { model: OPUS, tools: WRITE_DOCS },
	PLAN_SELF_REVIEW: { model: OPUS, tools: WRITE_DOCS },
	IMPLEMENT: { model: SONNET, tools: IMPLEMENT },
	REVIEW: { model: OPUS, tools: READ_ONLY },
	NOTES: { model: SONNET, tools: WRITE_DOCS },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors (will pass once `state.ts` from Task 2 exists).

---

## Task 7: `lib/prompts.ts` — per-phase prompt builders (FR-10..FR-26)

**Files:**
- Create: `agent/extensions/dev-pipeline/lib/prompts.ts`

Prompts are plain string builders; control flow never parses their output (FR-30). Each prompt instructs the LLM to `write` its artifact to an exact path so handoff is file-based (NFR-3).

- [ ] **Step 1: Implement `lib/prompts.ts`**

```ts
import type { PipelineState } from "../state.ts";

const PREAMBLE = (s: PipelineState) =>
	`You are one creative step in a deterministic dev pipeline for the activity: "${s.activity}".\n` +
	`Project context (compressed):\n${s.compressedContext}\n`;

/** FR-10/11: ≤5 highest-value questions, each with a recommended default + one-line reason. */
export function brainstormPrompt(s: PipelineState, questionsPath: string): string {
	return (
		PREAMBLE(s) +
		(s.decisions ? `\nDecisions so far / prior answers:\n${s.decisions}\n` : "") +
		`\nWrite at most 5 of the HIGHEST-VALUE open questions needed to design this well.\n` +
		`Anything you can infer from the context, STATE as an assumption — do NOT ask it.\n` +
		`Use this STRICT format, one block per question (the extension parses it to render a form):\n\n` +
		`Q: <question>\nDEFAULT: <your recommended answer>\nWHY: <one-line reason>\n\n` +
		`Then an "Assumptions:" section listing what you inferred.\n` +
		`Write the whole thing to the file "${questionsPath}" using the write tool. Write nothing else.`
	);
}

/** FR-13/14: design spec, scaled to complexity, zero placeholders. */
export function specPrompt(s: PipelineState, specPath: string): string {
	return (
		PREAMBLE(s) +
		`\nAgreed decisions from brainstorming:\n${s.decisions}\n` +
		`\nWrite a complete design spec for this feature. Scale the sections to the complexity.\n` +
		`ZERO placeholders: no "TBD", no "TODO", no "fill in later". Every section must be concrete.\n` +
		`Write it to "${specPath}" using the write tool. Write nothing else.`
	);
}

/** FR-15: self-review the spec, fixing inline only real issues. */
export function specReviewPrompt(specPath: string): string {
	return (
		`Re-read the design spec at "${specPath}".\n` +
		`Fix INLINE (using read + write) only real issues: contradictions, ambiguity, placeholders, gaps, scope creep.\n` +
		`Do not rewrite for style. When done, reply with exactly "clean" if nothing needed fixing, ` +
		`or a short bullet list of the fixes you made. The corrected file must remain at "${specPath}".`
	);
}

/** FR-17: the LLM decides WHAT to research and writes the lists; it executes nothing. */
export function researchDecisionPrompt(s: PipelineState, specPath: string, researchPath: string): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Decide what to research before writing the implementation plan. Do NOT run any tools to research now —\n` +
		`just LIST what should be looked up. Write to "${researchPath}" using the write tool, in this format:\n\n` +
		`PATTERNS:\n- <code pattern or symbol to grep for>\nFILES:\n- <path or glob of interest>\nLIBRARIES:\n- <library name to fetch docs for>\n\n` +
		`Write nothing else.`
	);
}

/** FR-19: bite-sized TDD tasks with exact paths + complete real code. No "→ commit" step (design §9). */
export function planAuthorPrompt(s: PipelineState, specPath: string, researchResults: string, planPath: string): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Research results gathered deterministically for you:\n${researchResults}\n\n` +
		`Write a complete implementation plan as bite-sized TDD tasks. Each task: failing test → minimal code → run/pass.\n` +
		`DO NOT include any git commit steps (this pipeline never commits).\n` +
		`Every code step must contain REAL, complete code and EXACT file paths — no "TBD", no "similar to Task N".\n` +
		`Start each task heading with "### Task N:" and put a one-line task title after the colon (the extension reads these to build a checklist).\n` +
		`Write it to "${planPath}" using the write tool. Write nothing else.`
	);
}

/** FR-20: self-review the plan for spec coverage, placeholders, type consistency. */
export function planReviewPrompt(specPath: string, planPath: string): string {
	return (
		`Re-read the design spec at "${specPath}" and the plan at "${planPath}".\n` +
		`Fix INLINE: ensure every spec requirement maps to a task; remove placeholders; make type/signature names consistent across tasks.\n` +
		`Reply "clean" or a short bullet list of fixes. The corrected plan stays at "${planPath}".`
	);
}

/** FR-22/24: implement ONE task with TDD. */
export function implementTaskPrompt(s: PipelineState, planPath: string, taskTitle: string, taskNumber: number): string {
	return (
		`Read the plan at "${planPath}". Implement ONLY Task ${taskNumber}: "${taskTitle}".\n` +
		`Follow TDD: write the failing test first, then the minimal code to pass it. Use read/write/edit/bash.\n` +
		`Run the tests yourself with bash to confirm they pass.\n` +
		`If after honest effort the task cannot pass, DO NOT weaken or delete the test. Instead reply starting with "BLOCKED:" and explain why.\n` +
		`Do NOT commit anything. Do NOT touch other tasks.`
	);
}

/** FR-25: final review from the working-tree git diff (not prior reports). */
export function reviewPrompt(): string {
	return (
		`Run \`git diff\` (and \`git status\`) with bash to see the full uncommitted change set.\n` +
		`Review it for correctness. Output, in your reply:\n` +
		`A line "Verdict: APPROVED" or "Verdict: CHANGES REQUIRED", then findings grouped under ` +
		`"Critical:", "Important:", "Minor:" — each citing file:line. Base the review ONLY on the diff.`
	);
}

/** FR-26: implementation notes artifact. */
export function notesPrompt(s: PipelineState, notesPath: string, verdict: string): string {
	const taskLines = s.tasks.map((t) => `- Task ${t.id} (${t.status}): ${t.title}`).join("\n");
	return (
		`Write implementation notes for "${s.activity}".\n` +
		`Code review verdict was: ${verdict}.\n` +
		`Tasks:\n${taskLines}\n\n` +
		`Include: what shipped per task, files changed (use \`git diff --stat\` via bash), deviations from the plan, test status,\n` +
		`and the verdict. If the verdict was CHANGES REQUIRED, list the outstanding issues.\n` +
		`Write it to "${notesPath}" using the write tool. Write nothing else.`
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors.

---

## Task 8: `orchestrator.ts` — phase driver, persistence, context filter (FR-6, FR-27, FR-28, NFR-2, NFR-4)

**Files:**
- Create: `agent/extensions/dev-pipeline/orchestrator.ts`

This is the engine. It is not unit-tested (it is pure glue over the verified pi API, per design §11); correctness is checked by `tsc` and the runtime smoke test.

- [ ] **Step 1: Implement `orchestrator.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PHASE_CONFIG, type ModelRef } from "./lib/models.ts";
import type { Phase, PipelineState } from "./state.ts";

export const STATE_ENTRY = "dev-pipeline-state";
const PHASE_MARKER = "dev-pipeline-phase-marker";

/** Persist the full state after every transition (NFR-4 resumability). */
export function persist(pi: ExtensionAPI, state: PipelineState): void {
	pi.appendEntry(STATE_ENTRY, state);
}

/** Restore the latest persisted state on the current branch, or null if none (FR-4). */
export function restore(ctx: ExtensionContext): PipelineState | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i] as { type?: string; customType?: string; data?: PipelineState };
		if (e.type === "custom" && e.customType === STATE_ENTRY && e.data) {
			return e.data;
		}
	}
	return null;
}

/** Apply the model + tool scope for a phase (FR-27, FR-29). Returns false if the model is unavailable. */
export async function applyPhaseConfig(pi: ExtensionAPI, ctx: ExtensionContext, phase: Phase): Promise<boolean> {
	const config = PHASE_CONFIG[phase];
	if (!config) return true; // non-LLM phase
	const model = ctx.modelRegistry.find(config.model.provider, config.model.id);
	if (!model) {
		ctx.ui.notify(`Model ${config.model.provider}/${config.model.id} not found.`, "error");
		return false;
	}
	const ok = await pi.setModel(model);
	if (!ok) {
		ctx.ui.notify(`No API key for ${config.model.provider}/${config.model.id}.`, "error");
		return false;
	}
	pi.setActiveTools(config.tools);
	return true;
}

/** Capture the session defaults so they can be restored at COMPLETE / RESET (FR-8.restore). */
export function captureDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: PipelineState): PipelineState {
	const all = pi.getAllTools().map((t) => t.name);
	const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null;
	return { ...state, originalModel: model, allToolNames: all };
}

/** Restore the original model + tools (COMPLETE / RESET / abort). */
export async function restoreDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: PipelineState): Promise<void> {
	if (state.allToolNames.length) pi.setActiveTools(state.allToolNames);
	if (state.originalModel) {
		const m = ctx.modelRegistry.find(state.originalModel.provider, state.originalModel.id);
		if (m) await pi.setModel(m);
	}
}

/**
 * Inject a hidden marker, then the phase prompt, triggering a turn.
 * The marker lets the context filter trim everything before this phase (FR-28).
 */
export function drivePhase(pi: ExtensionAPI, prompt: string): void {
	pi.sendMessage({ customType: PHASE_MARKER, content: "", display: false }, { triggerTurn: false });
	pi.sendUserMessage(prompt);
}

/**
 * FR-28 fresh context: keep only messages at/after the most recent phase marker,
 * dropping prior-phase chatter. The brainstorm loop is exempt (retains dialogue).
 * Returns the filtered messages array for the `context` event handler.
 */
export function filterContext(messages: unknown[], phase: Phase): unknown[] {
	if (phase === "BRAINSTORM") return messages; // retains the Q&A dialogue
	let lastMarker = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { customType?: string };
		if (m.customType === PHASE_MARKER) {
			lastMarker = i;
			break;
		}
	}
	if (lastMarker === -1) return messages;
	// Drop everything up to and including the marker (the marker itself is empty noise).
	return messages.slice(lastMarker + 1);
}

/** NFR-2: a creative step must have produced a non-empty artifact, else halt the phase. */
export async function artifactIsValid(pi: ExtensionAPI, path: string): Promise<boolean> {
	try {
		const r = await pi.exec("test", ["-s", path]); // -s: exists and size > 0
		return r.code === 0;
	} catch {
		return false;
	}
}
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors.

---

## Task 9: `ui/questions-form.ts` — brainstorm TUI form (FR-10, §7.1, FR-30 fallback)

**Files:**
- Create: `agent/extensions/dev-pipeline/ui/questions-form.ts`

User-confirmed: rich `ctx.ui.custom` form modeled on `examples/extensions/questionnaire.ts`. Each parsed question shows its DEFAULT pre-selected (option 1) plus "Type a different answer"; a final "Comments / refute" tab captures free text; an explicit "Proceed (no more questions)" choice ends the loop. If `parseQuestions` returned nothing, the caller passes `questions: []` and the form shows the raw file content with only the comments + proceed controls (FR-30 fallback).

- [ ] **Step 1: Implement `ui/questions-form.ts`**

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { ParsedQuestion } from "../lib/questions.ts";

export interface BrainstormFormResult {
	/** Per-question answers, in order. */
	answers: { prompt: string; answer: string }[];
	/** Free-text comments / refutation. */
	comments: string;
	/** True when the user chose to proceed (end the loop). */
	proceed: boolean;
	/** True when the user cancelled the whole pipeline. */
	cancelled: boolean;
}

/**
 * Render the brainstorm form. `questions` may be empty (raw fallback), in which case
 * `rawContent` is shown for reference and only comments + proceed are collected.
 */
export function showQuestionsForm(
	ctx: ExtensionContext,
	questions: ParsedQuestion[],
	rawContent: string,
): Promise<BrainstormFormResult> {
	const tabs = [...questions.map((q) => q.prompt), "Comments / refute", "Proceed →"];
	const commentsTab = questions.length;
	const proceedTab = questions.length + 1;

	return ctx.ui.custom<BrainstormFormResult>((tui, theme, _kb, done) => {
		let currentTab = 0;
		let optionIndex = 0;
		let inputMode = false;
		let inputTarget: "answer" | "comments" | null = null;
		let cachedLines: string[] | undefined;

		const answers = new Map<number, string>(); // question index -> answer
		let comments = "";

		const editorTheme: EditorTheme = {
			borderColor: (s) => theme.fg("accent", s),
			selectList: {
				selectedPrefix: (t) => theme.fg("accent", t),
				selectedText: (t) => theme.fg("accent", t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			},
		};
		const editor = new Editor(tui, editorTheme);

		function refresh() {
			cachedLines = undefined;
			tui.requestRender();
		}

		function optionsFor(qIndex: number): string[] {
			const q = questions[qIndex];
			return [`Accept default: ${q.default || "(none given)"}`, "Type a different answer"];
		}

		function finish(result: Partial<BrainstormFormResult>) {
			done({
				answers: questions.map((q, i) => ({ prompt: q.prompt, answer: answers.get(i) ?? q.default })),
				comments,
				proceed: false,
				cancelled: false,
				...result,
			});
		}

		editor.onSubmit = (value) => {
			const trimmed = value.trim();
			if (inputTarget === "answer") {
				answers.set(currentTab, trimmed || questions[currentTab].default);
			} else if (inputTarget === "comments") {
				comments = trimmed;
			}
			inputMode = false;
			inputTarget = null;
			editor.setText("");
			refresh();
		};

		function handleInput(data: string) {
			if (inputMode) {
				if (matchesKey(data, Key.escape)) {
					inputMode = false;
					inputTarget = null;
					editor.setText("");
					refresh();
					return;
				}
				editor.handleInput(data);
				refresh();
				return;
			}

			// Tab navigation
			if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
				currentTab = (currentTab + 1) % tabs.length;
				optionIndex = 0;
				refresh();
				return;
			}
			if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
				currentTab = (currentTab - 1 + tabs.length) % tabs.length;
				optionIndex = 0;
				refresh();
				return;
			}
			if (matchesKey(data, Key.escape)) {
				done({ answers: [], comments: "", proceed: false, cancelled: true });
				return;
			}

			// Proceed tab
			if (currentTab === proceedTab) {
				if (matchesKey(data, Key.enter)) finish({ proceed: true });
				return;
			}

			// Comments tab
			if (currentTab === commentsTab) {
				if (matchesKey(data, Key.enter)) {
					inputMode = true;
					inputTarget = "comments";
					editor.setText(comments);
					refresh();
				}
				return;
			}

			// Question tabs: option navigation
			const opts = optionsFor(currentTab);
			if (matchesKey(data, Key.up)) {
				optionIndex = Math.max(0, optionIndex - 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				optionIndex = Math.min(opts.length - 1, optionIndex + 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				if (optionIndex === 0) {
					answers.set(currentTab, questions[currentTab].default);
					if (currentTab < tabs.length - 1) currentTab++;
					optionIndex = 0;
					refresh();
				} else {
					inputMode = true;
					inputTarget = "answer";
					editor.setText("");
					refresh();
				}
			}
		}

		function render(width: number): string[] {
			if (cachedLines) return cachedLines;
			const lines: string[] = [];
			const add = (s: string) => lines.push(truncateToWidth(s, width));

			add(theme.fg("accent", "─".repeat(width)));

			// Tab bar
			const bar = tabs
				.map((t, i) => {
					const label = i === commentsTab ? "✎ Comments" : i === proceedTab ? "✓ Proceed" : `Q${i + 1}`;
					const answered = i < questions.length && answers.has(i);
					const text = ` ${answered ? "■" : "□"} ${label} `;
					return i === currentTab ? theme.bg("selectedBg", theme.fg("text", text)) : theme.fg("muted", text);
				})
				.join("");
			add(` ${bar}`);
			lines.push("");

			if (inputMode) {
				add(theme.fg("text", inputTarget === "comments" ? " Your comments / refutation:" : " Your answer:"));
				for (const l of editor.render(width - 2)) add(` ${l}`);
				lines.push("");
				add(theme.fg("dim", " Enter to submit • Esc to cancel edit"));
			} else if (currentTab === proceedTab) {
				add(theme.fg("success", theme.bold(" Proceed to the spec phase")));
				lines.push("");
				add(theme.fg("muted", " Press Enter to confirm you have no more doubts."));
			} else if (currentTab === commentsTab) {
				add(theme.fg("text", " Free-text comments or refutation (optional):"));
				lines.push("");
				add(comments ? `   ${theme.fg("text", comments)}` : theme.fg("dim", "   (empty)"));
				lines.push("");
				add(theme.fg("dim", " Enter to edit"));
			} else {
				const q = questions[currentTab];
				add(theme.fg("text", ` ${q.prompt}`));
				if (q.why) add(theme.fg("muted", `   why: ${q.why}`));
				lines.push("");
				const opts = optionsFor(currentTab);
				opts.forEach((opt, i) => {
					const sel = i === optionIndex;
					add((sel ? theme.fg("accent", "> ") : "  ") + theme.fg(sel ? "accent" : "text", opt));
				});
			}

			lines.push("");
			if (questions.length === 0) {
				add(theme.fg("warning", " (No structured questions parsed — raw model output below)"));
				for (const l of rawContent.split("\n").slice(0, 12)) add(theme.fg("dim", `   ${l}`));
				lines.push("");
			}
			add(theme.fg("dim", " Tab/←→ switch • ↑↓ select • Enter confirm • Esc cancel pipeline"));
			add(theme.fg("accent", "─".repeat(width)));

			cachedLines = lines;
			return lines;
		}

		// When there are no questions, start on the comments tab.
		if (questions.length === 0) currentTab = commentsTab;

		return {
			render,
			invalidate: () => {
				cachedLines = undefined;
			},
			handleInput,
		};
	});
}
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors. (If `tui.requestRender`/`Editor` types differ, align with `examples/extensions/questionnaire.ts:102-373`, the verified reference.)

---

## Task 10: `ui/approval-gate.ts` — approve / reject-with-feedback (FR-16, FR-21)

**Files:**
- Create: `agent/extensions/dev-pipeline/ui/approval-gate.ts`

- [ ] **Step 1: Implement `ui/approval-gate.ts`**

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const MAX_GATE_ATTEMPTS = 3;

export type GateResult =
	| { kind: "approved" }
	| { kind: "rejected"; feedback: string }
	| { kind: "cancelled" };

/**
 * Human approval gate (FR-16/21). Presents approve / reject / cancel.
 * On reject, collects feedback via the editor to drive the next revision.
 */
export async function approvalGate(ctx: ExtensionContext, what: string, artifactPath: string): Promise<GateResult> {
	ctx.ui.notify(`${what} written to ${artifactPath}. Review it, then choose below.`, "info");
	const choice = await ctx.ui.select(`Approve the ${what}?`, [
		"Approve",
		"Reject (give feedback to revise)",
		"Cancel pipeline",
	]);

	if (choice === "Approve") return { kind: "approved" };
	if (choice === "Reject (give feedback to revise)") {
		const feedback = (await ctx.ui.editor(`What should change in the ${what}?`, "")) ?? "";
		return { kind: "rejected", feedback: feedback.trim() };
	}
	return { kind: "cancelled" };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors.

---

## Task 11: `phases/` — the six phase handlers (FR-10..FR-26)

Each phase exports one function. They are driven by `index.ts` (Task 12): `index.ts` calls the phase's `start()` to set model/tools and inject the prompt; on `agent_end` it calls the phase's `onEnd()` (or, for the deterministic sub-steps, the helpers below). Phases hold no state — they receive the current `PipelineState` and return events the reducer consumes.

**Files:**
- Create: `agent/extensions/dev-pipeline/phases/brainstorm.ts`
- Create: `agent/extensions/dev-pipeline/phases/spec.ts`
- Create: `agent/extensions/dev-pipeline/phases/plan.ts`
- Create: `agent/extensions/dev-pipeline/phases/implement.ts`
- Create: `agent/extensions/dev-pipeline/phases/review.ts`
- Create: `agent/extensions/dev-pipeline/phases/notes.ts`

- [ ] **Step 1: `phases/brainstorm.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { parseQuestions } from "../lib/questions.ts";
import { brainstormPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp, sanitizeSlug } from "../lib/paths.ts";
import { showQuestionsForm } from "../ui/questions-form.ts";
import type { PipelineEvent, PipelineState } from "../state.ts";

export const MAX_ITERATIONS = 10;

export function questionsPathFor(s: PipelineState): string {
	const slug = s.slug ?? "pipeline-tmp";
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), slug, "questions");
}

/** Inject one brainstorm round. */
export async function startBrainstorm(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", `🧠 brainstorm (round ${s.questionRound + 1})`);
	if (!(await applyPhaseConfig(pi, ctx, "BRAINSTORM"))) return;
	drivePhase(pi, brainstormPrompt(s, questionsPathFor(s)));
}

/**
 * After the LLM wrote the questions file: parse, render the form, and return the next event.
 * Returns PROCEED (advance), QUESTION_ROUND (loop again), or RESET (user cancelled).
 */
export async function onBrainstormEnd(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<PipelineEvent> {
	const path = questionsPathFor(s);
	let raw = "";
	try {
		const r = await pi.exec("cat", [path]);
		raw = r.code === 0 ? r.stdout : "";
	} catch {
		raw = "";
	}
	const questions = parseQuestions(raw); // [] → fallback handled by the form
	const result = await showQuestionsForm(ctx, questions, raw);

	if (result.cancelled) return { type: "RESET" };

	// Accumulate this round's answers + comments into decisions.
	const roundText = [
		`### Round ${s.questionRound + 1}`,
		...result.answers.map((a) => `- ${a.prompt} → ${a.answer}`),
		result.comments ? `- Comments/refute: ${result.comments}` : "",
	]
		.filter(Boolean)
		.join("\n");
	s.decisions = `${s.decisions}\n\n${roundText}`.trim();

	const atCap = s.questionRound + 1 >= MAX_ITERATIONS;
	if (result.proceed || atCap) {
		const slug = sanitizeSlug(s.activity); // refined to LLM-named slug in spec phase if desired
		return { type: "PROCEED", decisions: s.decisions, slug };
	}
	return { type: "QUESTION_ROUND" };
}
```

> Note: `decisions` is mutated on the working copy here for convenience; `index.ts` always re-persists the reduced state, so the durable record stays consistent. The `PROCEED` event also carries `decisions` so the reducer stores it canonically.

- [ ] **Step 2: `phases/spec.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { specPrompt, specReviewPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { PipelineState } from "../state.ts";

export function specPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "design");
}

export async function startSpec(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "📝 spec");
	if (!(await applyPhaseConfig(pi, ctx, "SPEC"))) return;
	drivePhase(pi, specPrompt(s, specPathFor(s)));
}

/** Returns true if the spec file is valid (advance to self-review), false to halt (NFR-2). */
export async function onSpecEnd(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<boolean> {
	const path = specPathFor(s);
	if (!(await artifactIsValid(pi, path))) {
		ctx.ui.notify("Spec phase produced no file — halting pipeline (NFR-2).", "error");
		return false;
	}
	return true;
}

export async function startSpecReview(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔎 spec self-review");
	if (!(await applyPhaseConfig(pi, ctx, "SPEC_SELF_REVIEW"))) return;
	drivePhase(pi, specReviewPrompt(specPathFor(s)));
}
```

- [ ] **Step 3: `phases/plan.ts`** (research decision → deterministic research → author → review)

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { planAuthorPrompt, planReviewPrompt, researchDecisionPrompt } from "../lib/prompts.ts";
import { specPathFor } from "./spec.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { Task, PipelineState } from "../state.ts";

export function researchPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "research");
}
export function planPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "plan");
}

export async function startPlanResearch(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔬 plan research");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_RESEARCH"))) return;
	drivePhase(pi, researchDecisionPrompt(s, specPathFor(s), researchPathFor(s)));
}

/**
 * FR-18: run the requested research deterministically. Missing tool → empty section, never error.
 * Reads the research-decision file, executes rg always, ast-grep/graphify/ctx7 conditionally,
 * and returns a results string to feed the plan author.
 */
export async function runResearch(
	pi: ExtensionAPI,
	s: PipelineState,
	probes: { astGrep: boolean; graphify: boolean },
): Promise<string> {
	let decision = "";
	try {
		const r = await pi.exec("cat", [researchPathFor(s)]);
		decision = r.code === 0 ? r.stdout : "";
	} catch {
		decision = "";
	}

	const patterns = extractList(decision, "PATTERNS");
	const libraries = extractList(decision, "LIBRARIES");
	const sections: string[] = [];

	// rg: always
	for (const pat of patterns) {
		const out = await safe(pi, "rg", ["-n", "--max-count", "20", pat]);
		sections.push(`### rg "${pat}"\n${out || "(no matches)"}`);
	}
	// ast-grep: only if available
	if (probes.astGrep) {
		for (const pat of patterns) {
			const out = await safe(pi, "ast-grep", ["run", "--pattern", pat]);
			if (out) sections.push(`### ast-grep "${pat}"\n${out}`);
		}
	}
	// graphify: only if graphify-out/ exists
	if (probes.graphify) {
		const out = await safe(pi, "npx", ["ctx7", "--help"]); // placeholder query target documented below
		void out;
	}
	// ctx7: for named libraries
	for (const lib of libraries) {
		const out = await safe(pi, "npx", ["ctx7@latest", "library", lib]);
		sections.push(`### ctx7 ${lib}\n${(out || "(no docs)").slice(0, 1500)}`);
	}

	return sections.join("\n\n") || "(no research results)";
}

export async function startPlanAuthor(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	s: PipelineState,
	researchResults: string,
): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "✍️ plan author");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_AUTHOR"))) return;
	drivePhase(pi, planAuthorPrompt(s, specPathFor(s), researchResults, planPathFor(s)));
}

export async function startPlanReview(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔎 plan self-review");
	if (!(await applyPhaseConfig(pi, ctx, "PLAN_SELF_REVIEW"))) return;
	drivePhase(pi, planReviewPrompt(specPathFor(s), planPathFor(s)));
}

/** Parse "### Task N: title" headings into the task list (control flow uses files, not LLM JSON). */
export async function readTasks(pi: ExtensionAPI, s: PipelineState): Promise<Task[]> {
	let md = "";
	try {
		const r = await pi.exec("cat", [planPathFor(s)]);
		md = r.code === 0 ? r.stdout : "";
	} catch {
		md = "";
	}
	const tasks: Task[] = [];
	for (const line of md.split("\n")) {
		const m = line.match(/^###\s+Task\s+(\d+):\s*(.+)$/);
		if (m) tasks.push({ id: Number(m[1]), title: m[2].trim(), status: "pending" });
	}
	return tasks;
}

export async function planFileValid(pi: ExtensionAPI, s: PipelineState): Promise<boolean> {
	return artifactIsValid(pi, planPathFor(s));
}

function extractList(text: string, header: string): string[] {
	const lines = text.split("\n");
	const out: string[] = [];
	let inSection = false;
	for (const line of lines) {
		if (new RegExp(`^${header}:`).test(line.trim())) {
			inSection = true;
			continue;
		}
		if (/^[A-Z]+:/.test(line.trim())) inSection = false;
		if (inSection) {
			const item = line.match(/^\s*-\s*(.+)$/);
			if (item) out.push(item[1].trim());
		}
	}
	return out;
}

async function safe(pi: ExtensionAPI, command: string, args: string[]): Promise<string> {
	try {
		const r = await pi.exec(command, args, { timeout: 30000 });
		return r.code === 0 ? r.stdout.trim() : "";
	} catch {
		return "";
	}
}
```

> Worker note on graphify: design FR-18 says "graphify query only if `graphify-out/` exists". The exact graphify query CLI is project-local; v1 keeps the branch guarded and emits nothing when absent. If the project documents a graphify query command, wire it where the placeholder `void out;` is and append its output to `sections`. This is the one spot left intentionally minimal because the graphify CLI surface is **UNVERIFIED** against an external source.

- [ ] **Step 4: `phases/implement.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { implementTaskPrompt } from "../lib/prompts.ts";
import { planPathFor } from "./plan.ts";
import type { PipelineState } from "../state.ts";

/** Inject the prompt for the current task. */
export async function startCurrentTask(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	const task = s.tasks[s.currentTaskIndex];
	if (!task) return;
	ctx.ui.setStatus("dev-pipeline", `⚙️ implement ${s.currentTaskIndex + 1}/${s.tasks.length}`);
	if (!(await applyPhaseConfig(pi, ctx, "IMPLEMENT"))) return;
	drivePhase(pi, implementTaskPrompt(s, planPathFor(s), task.title, task.id));
}

/**
 * FR-24 + design §9.2: verify the task deterministically. Returns:
 * - "done" if the detected test command passes,
 * - "blocked" if the LLM declared BLOCKED or tests fail.
 * Detects the test command from the project's package.json (scripts.test) and falls back to `bun test`.
 */
export async function verifyTask(pi: ExtensionAPI, lastAssistantText: string): Promise<"done" | "blocked"> {
	if (/^\s*BLOCKED:/m.test(lastAssistantText)) return "blocked";
	const cmd = await detectTestCommand(pi);
	try {
		const r = await pi.exec(cmd.command, cmd.args, { timeout: 120000 });
		return r.code === 0 ? "done" : "blocked";
	} catch {
		return "blocked";
	}
}

async function detectTestCommand(pi: ExtensionAPI): Promise<{ command: string; args: string[] }> {
	try {
		const r = await pi.exec("cat", ["package.json"]);
		if (r.code === 0) {
			const pkg = JSON.parse(r.stdout) as { scripts?: Record<string, string> };
			if (pkg.scripts?.test) return { command: "npm", args: ["test", "--silent"] };
		}
	} catch {
		// fall through
	}
	return { command: "bun", args: ["test"] };
}
```

- [ ] **Step 5: `phases/review.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { reviewPrompt } from "../lib/prompts.ts";
import type { PipelineState } from "../state.ts";

export async function startReview(pi: ExtensionAPI, ctx: ExtensionContext, _s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🧐 code review");
	if (!(await applyPhaseConfig(pi, ctx, "REVIEW"))) return;
	drivePhase(pi, reviewPrompt());
}

/** Extract the verdict from the review reply (used only to record state, not for control flow gating). */
export function parseVerdict(text: string): "APPROVED" | "CHANGES_REQUIRED" {
	return /verdict:\s*approved/i.test(text) ? "APPROVED" : "CHANGES_REQUIRED";
}
```

- [ ] **Step 6: `phases/notes.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { notesPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { PipelineState } from "../state.ts";

export function notesPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "implementation");
}

export async function startNotes(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🗒️ notes");
	if (!(await applyPhaseConfig(pi, ctx, "NOTES"))) return;
	drivePhase(pi, notesPrompt(s, notesPathFor(s), s.reviewVerdict ?? "UNKNOWN"));
}

export async function notesFileValid(pi: ExtensionAPI, s: PipelineState): Promise<boolean> {
	return artifactIsValid(pi, notesPathFor(s));
}
```

- [ ] **Step 7: Typecheck all phases**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors.

---

## Task 12: `index.ts` — wiring & the agent_end dispatcher (FR-1, FR-3, FR-4, FR-28)

**Files:**
- Create: `agent/extensions/dev-pipeline/index.ts`

This is the single place that holds the live `PipelineState` in memory, owns the trigger, and routes each `agent_end` to the active phase. After every transition it persists and drives the next phase.

- [ ] **Step 1: Implement `index.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createInitialState, transition, type PipelineEvent, type PipelineState } from "./state.ts";
import {
	applyPhaseConfig,
	captureDefaults,
	drivePhase,
	filterContext,
	persist,
	restore,
	restoreDefaults,
} from "./orchestrator.ts";
import { gatherContext } from "./context/gather.ts";
import { compressContext } from "./context/compress.ts";
import { artifactFolderFor } from "./lib/paths.ts";
import { approvalGate, type GateResult, MAX_GATE_ATTEMPTS } from "./ui/approval-gate.ts";
import { onBrainstormEnd, startBrainstorm } from "./phases/brainstorm.ts";
import { onSpecEnd, specPathFor, startSpec, startSpecReview } from "./phases/spec.ts";
import {
	planFileValid,
	planPathFor,
	readTasks,
	runResearch,
	startPlanAuthor,
	startPlanResearch,
	startPlanReview,
} from "./phases/plan.ts";
import { startCurrentTask, verifyTask } from "./phases/implement.ts";
import { parseVerdict, startReview } from "./phases/review.ts";
import { notesFileValid, startNotes } from "./phases/notes.ts";

export default function devPipeline(pi: ExtensionAPI): void {
	let state: PipelineState | null = null;
	// Probes captured during context gathering, needed later by the research phase.
	let probes = { astGrep: false, graphify: false };

	pi.registerFlag("pipeline", {
		type: "string",
		description: "Run the deterministic dev pipeline for <activity>",
	});

	// --- Trigger (FR-1) ---
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" }; // ignore our own injected msgs (no loops)
		if (!event.text.includes("--pipeline")) return { action: "continue" };
		const activity = event.text.split("--pipeline").join("").trim();
		await startPipeline(pi, ctx, activity);
		return { action: "handled" };
	});

	// --- /pipeline alias (FR-1) ---
	pi.registerCommand("pipeline", {
		description: "Run the deterministic dev pipeline for <activity>",
		handler: async (args, ctx) => {
			await startPipeline(pi, ctx as unknown as ExtensionContext, args.trim());
		},
	});

	async function startPipeline(api: ExtensionAPI, ctx: ExtensionContext, activity: string): Promise<void> {
		if (!ctx.hasUI) {
			ctx.ui.notify("dev-pipeline requires an interactive UI.", "error");
			return;
		}
		if (!activity) {
			ctx.ui.notify("Usage: --pipeline <activity>", "warning");
			return;
		}
		state = captureDefaults(api, ctx, createInitialState(activity));
		await advance(api, ctx, { type: "START" });
	}

	// --- Fresh context per phase (FR-28) ---
	pi.on("context", async (event) => {
		if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") return;
		return { messages: filterContext(event.messages as unknown[], state.phase) as typeof event.messages };
	});

	// --- The dispatcher: each agent_end maps to the active phase (FR-2, §6) ---
	pi.on("agent_end", async (event, ctx) => {
		if (!state) return;
		const lastText = lastAssistantText(event.messages as unknown[]);

		switch (state.phase) {
			case "BRAINSTORM": {
				const ev = await onBrainstormEnd(pi, ctx, state);
				await advance(pi, ctx, ev);
				break;
			}
			case "SPEC": {
				if (!(await onSpecEnd(pi, ctx, state))) {
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				await advance(pi, ctx, { type: "SPEC_WRITTEN", specPath: specPathFor(state) });
				break;
			}
			case "SPEC_SELF_REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED" });
				break;
			}
			case "PLAN_RESEARCH": {
				await advance(pi, ctx, { type: "RESEARCH_DECIDED" });
				break;
			}
			case "PLAN_AUTHOR": {
				if (!(await planFileValid(pi, state))) {
					ctx.ui.notify("Plan phase produced no file — halting (NFR-2).", "error");
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				const tasks = await readTasks(pi, state);
				await advance(pi, ctx, { type: "PLAN_WRITTEN", planPath: planPathFor(state), tasks });
				break;
			}
			case "PLAN_SELF_REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED" });
				break;
			}
			case "IMPLEMENT": {
				const outcome = await verifyTask(pi, lastText);
				if (outcome === "blocked") {
					ctx.ui.notify(`Task ${state.currentTaskIndex + 1} BLOCKED — halting (FR-24).`, "error");
					await advance(pi, ctx, { type: "BLOCKED" });
					break;
				}
				await advance(pi, ctx, { type: "TASK_DONE" });
				break;
			}
			case "REVIEW": {
				await advance(pi, ctx, { type: "REVIEWED_CODE", verdict: parseVerdict(lastText) });
				break;
			}
			case "NOTES": {
				if (!(await notesFileValid(pi, state))) {
					ctx.ui.notify("Notes phase produced no file — halting (NFR-2).", "error");
					await advance(pi, ctx, { type: "RESET" });
					break;
				}
				await advance(pi, ctx, { type: "NOTES_WRITTEN", notesPath: "" });
				break;
			}
		}
	});

	// --- Resume on session start (FR-4 / NFR-4) ---
	pi.on("session_start", async (event, ctx) => {
		if (event.reason !== "resume" && event.reason !== "reload") return;
		const restored = restore(ctx);
		if (restored && restored.phase !== "IDLE" && restored.phase !== "COMPLETE") {
			state = restored;
			ctx.ui.notify(`dev-pipeline resumed at phase: ${state.phase}`, "info");
			await driveCurrentPhase(pi, ctx);
		}
	});

	/**
	 * Apply an event, persist, then perform the side effects for the NEW phase.
	 * Deterministic phases (GATHERING_CONTEXT, gates, research execution, IMPLEMENT advance)
	 * are handled here without LLM tokens.
	 */
	async function advance(api: ExtensionAPI, ctx: ExtensionContext, event: PipelineEvent): Promise<void> {
		if (!state) return;
		state = transition(state, event);
		persist(api, state);
		await driveCurrentPhase(api, ctx);
	}

	async function driveCurrentPhase(api: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
		if (!state) return;
		switch (state.phase) {
			case "GATHERING_CONTEXT": {
				ctx.ui.setStatus("dev-pipeline", "📦 gathering context");
				const folder = artifactFolderFor(ctx.cwd);
				await api.exec("mkdir", ["-p", folder]); // FR-5: create if absent
				const gathered = await gatherContext((c, a, o) => api.exec(c, a, o), ctx.cwd);
				probes = { astGrep: gathered.astGrep, graphify: gathered.graphify };
				const compressed = compressContext({ stack: gathered.stack, probes: gathered.probes, tree: gathered.tree });
				await advance(api, ctx, { type: "CONTEXT_READY", compressedContext: compressed, artifactFolder: folder });
				break;
			}
			case "BRAINSTORM":
				await startBrainstorm(api, ctx, state);
				break;
			case "SPEC":
				await startSpec(api, ctx, state);
				break;
			case "SPEC_SELF_REVIEW":
				await startSpecReview(api, ctx, state);
				break;
			case "SPEC_GATE":
				await runGate(api, ctx, "spec", specPathFor(state));
				break;
			case "PLAN_RESEARCH":
				await startPlanResearch(api, ctx, state);
				break;
			case "PLAN_AUTHOR": {
				// Deterministic research runs BEFORE the author prompt (FR-18).
				const results = await runResearch(api, state, probes);
				await startPlanAuthor(api, ctx, state, results);
				break;
			}
			case "PLAN_SELF_REVIEW":
				await startPlanReview(api, ctx, state);
				break;
			case "PLAN_GATE":
				await runGate(api, ctx, "plan", planPathFor(state));
				break;
			case "IMPLEMENT":
				if (state.currentTaskIndex >= state.tasks.length) {
					await advance(api, ctx, { type: "ALL_TASKS_DONE" });
				} else {
					await startCurrentTask(api, ctx, state);
				}
				break;
			case "REVIEW":
				await startReview(api, ctx, state);
				break;
			case "NOTES":
				await startNotes(api, ctx, state);
				break;
			case "BLOCKED":
				ctx.ui.notify("Pipeline halted (BLOCKED). Review the working tree and re-run when ready.", "warning");
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
			case "COMPLETE":
				ctx.ui.notify(`Pipeline complete. Verdict: ${state.reviewVerdict}. Artifacts in the Obsidian folder.`, "info");
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
			case "IDLE":
				// Reached via RESET/cancel: restore session defaults.
				await restoreDefaults(api, ctx, state);
				ctx.ui.setStatus("dev-pipeline", undefined);
				break;
		}
	}

	async function runGate(api: ExtensionAPI, ctx: ExtensionContext, what: "spec" | "plan", path: string): Promise<void> {
		if (!state) return;
		const result: GateResult = await approvalGate(ctx, what, path);
		if (result.kind === "approved") {
			await advance(api, ctx, { type: "APPROVED" });
		} else if (result.kind === "cancelled") {
			await advance(api, ctx, { type: "RESET" });
		} else {
			if (state.gateAttempts + 1 >= MAX_GATE_ATTEMPTS) {
				ctx.ui.notify(`Max ${what} revision attempts reached — halting.`, "warning");
				await advance(api, ctx, { type: "RESET" });
				return;
			}
			// Feed the feedback into the next revision via a steer message, then loop the phase.
			pi.sendMessage(
				{ customType: "dev-pipeline-gate-feedback", content: `Revise the ${what}: ${result.feedback}`, display: true },
				{ triggerTurn: false },
			);
			await advance(api, ctx, { type: "REJECT", feedback: result.feedback });
		}
	}
}

/** Best-effort extraction of the last assistant text from agent_end messages (structural, no extra deps). */
function lastAssistantText(messages: unknown[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { role?: string; content?: unknown };
		if (m.role !== "assistant") continue;
		if (typeof m.content === "string") return m.content;
		if (Array.isArray(m.content)) {
			return m.content
				.filter((c): c is { type: string; text: string } => (c as { type?: string }).type === "text")
				.map((c) => c.text)
				.join("\n");
		}
	}
	return "";
}
```

> Worker notes:
> - `ctx.cwd` is on `ExtensionContext` (used by `gemini/lib/open.ts` and `google-search` via `ctx.cwd`). If `tsc` reports it missing, read it from `ctx.sessionManager.getCwd()` (verified at `session-manager.d.ts` Pick list).
> - The `REJECT` revision path re-enters `SPEC`/`PLAN_AUTHOR`; for the plan, re-entering `PLAN_AUTHOR` re-runs `runResearch` — acceptable for v1 (research is cheap and idempotent). The feedback steer message is injected before the phase prompt so the author sees it.
> - `NOTES_WRITTEN` carries `notesPath: ""` then the reducer records COMPLETE; the actual path is available via `notesPathFor(state)` if needed for display.

- [ ] **Step 2: Typecheck the whole extension**

Run: `cd agent/extensions/dev-pipeline && bunx tsc --noEmit`
Expected: no errors. Fix any signature mismatches against the verified API table at the top of this plan.

- [ ] **Step 3: Run the full unit suite**

Run: `cd agent/extensions/dev-pipeline && bun test`
Expected: PASS — paths, state, compress, gather, questions suites all green.

---

## Task 13: README + smoke test (design §11)

**Files:**
- Create: `agent/extensions/dev-pipeline/README.md`
- Create: `agent/extensions/dev-pipeline/tests/smoke-deterministic.test.ts`

- [ ] **Step 1: Write the deterministic smoke test**

This runs the deterministic path (`gather → compress → paths`) against a tiny sample repo created in a temp dir, asserting FR-5 mangling, FR-6 exclusions, and the FR-9 budget. It uses a real `exec` via `node:child_process` so it exercises actual `eza`/shell behavior.

`tests/smoke-deterministic.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { gatherContext, type ExecFn } from "../context/gather.ts";
import { compressContext, MAX_CONTEXT_CHARS } from "../context/compress.ts";
import { artifactFolderFor } from "../lib/paths.ts";

const realExec: ExecFn = (command, args) =>
	new Promise((resolve) => {
		execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
		});
	});

test("smoke: deterministic path on a tiny sample repo", async () => {
	const repo = mkdtempSync(join(tmpdir(), "pipe-"));
	mkdirSync(join(repo, "node_modules", "junk"), { recursive: true });
	mkdirSync(join(repo, "src"), { recursive: true });
	writeFileSync(join(repo, "src", "index.ts"), "export const x = 1;\n");
	writeFileSync(
		join(repo, "package.json"),
		JSON.stringify({ name: "sample", dependencies: { left: "1.0.0" }, scripts: { test: "bun test" } }),
	);

	const gathered = await gatherContext(realExec, repo);
	// FR-6: excluded dirs omitted from the tree.
	expect(gathered.tree).not.toContain("node_modules");
	// FR-7: compressed stack signal only.
	expect(gathered.stack).toContain("sample");
	expect(gathered.stack).toContain("left");
	expect(gathered.stack).not.toContain("1.0.0");

	const compressed = compressContext({ stack: gathered.stack, probes: gathered.probes, tree: gathered.tree });
	// FR-9: within the char budget.
	expect(compressed.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);

	// FR-5: folder mangling.
	const folder = artifactFolderFor("/Users/me/work/x", "/Users/me");
	expect(folder).toBe("/Users/me/obsidian/Documents/me_work_x");
});
```

- [ ] **Step 2: Run the smoke test**

Run: `cd agent/extensions/dev-pipeline && bun test tests/smoke-deterministic.test.ts`
Expected: PASS. (Requires `eza` on PATH — it is, per the user's global tooling. If `eza` is absent the tree falls back to `(tree unavailable)` and the `node_modules` assertion still holds.)

- [ ] **Step 3: Write `README.md`**

````markdown
# dev-pipeline

A self-contained pi extension implementing a deterministic dev pipeline:
**Context → Brainstorm → Spec → Plan → Implement → Review → Notes.**

The TypeScript state machine orchestrates; the LLM only creates. Phases hand off via
markdown files written with the built-in `write` tool. No JSON parsing for control flow,
no custom tools, no commits, no branches/worktrees.

## Setup

Auto-discovered via `~/.pi/agent/extensions/` (symlink to `~/.config/pi`). Install deps:

```bash
cd agent/extensions/dev-pipeline && bun install
```

## Usage

In an interactive pi session, inside the target git repo:

```
--pipeline add a dark-mode toggle
```

or the command alias:

```
/pipeline add a dark-mode toggle
```

The pipeline will:
1. Gather context deterministically (eza tree, stack signal, ast-grep/graphify probes) — 0 tokens.
2. Brainstorm: answer ≤5 questions per round (defaults pre-filled), or refute; proceed when done.
3. Write + self-review the design spec → you approve or reject-with-feedback.
4. Decide research → run it deterministically → write + self-review the plan → you approve.
5. Implement task-by-task with TDD (tests verified by the extension); halts BLOCKED if a task can't pass honestly.
6. Review the working-tree `git diff` → verdict.
7. Write implementation notes.

Artifacts land in `~/obsidian/Documents/<mangled-cwd>/<date>-<slug>-<type>.md`.
**Nothing is committed** — review the working tree and commit manually.

## Models

- sonnet (`github-copilot/claude-sonnet-4.6`): brainstorm, plan-research, implement, notes.
- opus (`github-copilot/claude-opus-4.6`): spec, plan-author, reviews.

Configurable in `lib/models.ts`.

## Resume

State is persisted after every transition. Re-opening/resuming the session re-arms the
pipeline at the last phase.

## Tests

```bash
bun test
```

Unit tests cover the deterministic pieces (state machine, compression, path mangling,
stack detection, question parsing) plus a deterministic smoke test on a sample repo.
````

- [ ] **Step 4: Final full run**

Run: `cd agent/extensions/dev-pipeline && bun test && bunx tsc --noEmit`
Expected: all suites PASS; no type errors.

---

## Self-Review (plan author's checklist — completed)

**1. Spec coverage (FR-1..FR-30, NFR-1..NFR-10):**

| Requirement | Task |
|---|---|
| FR-1 trigger `--pipeline` + `/pipeline`, intercept | Task 12 (`on("input")`, `registerCommand`) |
| FR-2 deterministic state machine, 0 tokens | Task 2 (`transition`) |
| FR-3 self-contained, zero external config | Task 0 + Task 12 (reads only target repo) |
| FR-4 resume by phase | Task 8 (`restore`) + Task 12 (`session_start`) |
| FR-5 artifact folder mangling | Task 1 (`artifactFolderFor`) + Task 12 (mkdir) |
| FR-6 eza tree with exclusions | Task 4 (`buildTreeArgs`, `EXCLUDE_DIRS`) |
| FR-7 stack compressed signal | Task 4 (`parseStack`) |
| FR-8 ast-grep/graphify probes | Task 4 (`gatherContext`) |
| FR-9 ≤2K-token compression | Task 3 (`compressContext`) |
| FR-10/11/12 brainstorm loop + decisions | Task 9 (form) + Task 11.1 + Task 12 |
| FR-13/14 spec + slug | Task 11.2 + Task 1 (`sanitizeSlug`) |
| FR-15 spec self-review | Task 11.2 (`startSpecReview`) |
| FR-16 spec gate | Task 10 + Task 12 (`runGate`) |
| FR-17 research decision (no execution) | Task 7 (`researchDecisionPrompt`) + Task 11.3 |
| FR-18 deterministic research, missing tool→empty | Task 11.3 (`runResearch`, `safe`) |
| FR-19 plan as TDD tasks, no commit step | Task 7 (`planAuthorPrompt`) |
| FR-20 plan self-review | Task 11.3 (`startPlanReview`) |
| FR-21 plan gate | Task 10 + Task 12 |
| FR-22 implement TDD single-agent | Task 11.4 + Task 12 |
| FR-23 no branch/worktree (strengthened: no commits) | design §9; no git-write code anywhere |
| FR-24 BLOCKED report, no weakened tests | Task 11.4 (`verifyTask`) + Task 12 |
| FR-25 review from git diff + verdict | Task 11.5 (`reviewPrompt`, `parseVerdict`) |
| FR-26 implementation notes | Task 11.6 |
| FR-27 model routing | Task 6 (`PHASE_CONFIG`) |
| FR-28 fresh context per phase | Task 8 (`filterContext`) + Task 12 (`on("context")`) |
| FR-29 tool scoping per phase | Task 6 + Task 8 (`applyPhaseConfig`) |
| FR-30 file handoffs, no JSON control flow | Tasks 7–12 (all handoffs via files/agent_end) |
| NFR-1 token efficiency | Tasks 3,4,8 |
| NFR-2 no silent cascades | Task 8 (`artifactIsValid`) + Task 12 halts |
| NFR-3 robust handoffs | Task 8/12 (write/read + agent_end) |
| NFR-4 resumability | Task 8/12 |
| NFR-5 no isolation side effects | design §9; no git-write |
| NFR-6 self-containment | Task 0/12 |
| NFR-7 security/blast radius | Task 6 (scoped built-ins only) |
| NFR-8 observability | `ctx.ui.setStatus` in every phase |
| NFR-9 cost control | Task 6 (opus only for spec/plan/review) |
| NFR-10 UX v1 text gates | Task 10 (text gates); form is rich per user override |

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" remain in the code blocks. The one intentional minimal branch (graphify query) is explicitly flagged **UNVERIFIED** with instructions, because the graphify CLI surface could not be confirmed against a primary source — this is disclosed, not hidden.

**3. Type consistency:** `PipelineState`/`Phase`/`PipelineEvent`/`Task` are defined once in `state.ts` and imported everywhere. Path helpers (`specPathFor`, `planPathFor`, `notesPathFor`, `researchPathFor`, `questionsPathFor`) each live in their phase module and are imported where reused (e.g. `index.ts` imports `specPathFor`/`planPathFor`; `plan.ts` imports `specPathFor` from `spec.ts`). `applyPhaseConfig`/`drivePhase`/`artifactIsValid` signatures match between `orchestrator.ts` and all callers. `ExecFn` in `gather.ts` matches `pi.exec`'s `(command, args, {timeout?})` shape.

**Open items the worker must confirm at implementation time (flagged, not hidden):**
- `ctx.cwd` vs `ctx.sessionManager.getCwd()` — both plausible; verified `getCwd()` exists, `ctx.cwd` used by gemini. Use whichever `tsc` accepts.
- TUI `Editor`/`tui.requestRender`/`theme.bg` exact names — mirror `questionnaire.ts` (the verified reference) if any mismatch.
- graphify query CLI — **UNVERIFIED**; left guarded/empty until the project's graphify command is confirmed.

