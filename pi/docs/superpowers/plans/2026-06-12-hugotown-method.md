# hugotown-method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `hugotown-method`, a native pi extension that runs Archon-style YAML DAG workflows (7 node types) entirely inside pi, with `wt` worktree isolation, GitHub lifecycle via `gh` bash nodes, structured output, approval gates, and resume-on-failure.

**Architecture:** A self-contained pi extension. A `/hugotown-method` command loads a workflow YAML, validates the DAG, optionally creates a `wt` worktree, then runs nodes in topological layers (parallel within a layer, bounded by a semaphore). AI nodes spawn isolated `pi --mode json -p --no-session` subprocesses; deterministic nodes (bash/script/cancel) run in-process. Approval gates and failure recovery share ONE resumable engine: state persists to `.hugotown/runs/<id>.json` plus a session entry, the command handler returns (never blocks), and a second `/hugotown-method approve|reject|resume` invocation reloads state and continues the DAG, skipping completed nodes.

**Tech Stack:** TypeScript (ESNext, bundler resolution, loaded via jiti), runtime `node:child_process` for spawning, `@earendil-works/pi-coding-agent` 0.75.4, `@earendil-works/pi-tui` 0.75.4, `typebox` 1.1.38, `yaml` 2.9.0. Tests via `bun test`.

**Engineering constraints (NON-NEGOTIABLE):**
- SOLID + DRY. One responsibility per file.
- 70 LOC target per file, 120 LOC hard cap (including blanks + comments).
- 1 agent = 1 unit = one source file + its co-located test file (TDD red-green in the same unit).
- Every public function is covered; unit + integration coverage > 90%.
- Integration tests spawn REAL `pi`; assert on mechanics + JSON-schema conformance, and use output-constrained prompts where exact content must be asserted.
- All code/comments/docs in English.

---

## Ground-Truth Reference (verified AS_IS — do not re-derive)

**pi CLI invocation for AI nodes** (from `extensions/subagent/lib/pi-invocation.ts`, `runner.ts`):
```
<piBinary> --mode json -p --no-session --provider <p> --model <m> --thinking <low|medium|high> [--tools <allowed.join(",")>] --append-system-prompt <tmpfile.md> "<task text as final positional arg>"
```
- NO `--prompt-file`, NO `--no-skills`, NO `--deny-tools`. Tools are an ALLOWLIST only; to block, pass `allowed = universe − blocked`.
- Binary resolution: if `process.argv[1]` exists and is not `/$bunfs/root/` → `[process.execPath, argv[1], ...args]`; else if `process.execPath` basename matches `/^pi(\.exe)?$/` → reuse it; else `"pi"` on PATH.
- Spawn: `node:child_process` `spawn(cmd, args, { cwd, shell: false, stdio: ["ignore","pipe","pipe"] })`.
- System prompt: temp `.md` file (mode 0o600) via `--append-system-prompt`; cleaned up in `finally`.

**pi `--mode json` output = NDJSON** (one JSON object per `\n` line). Event types consumed:
- `message_update` → `assistantMessageEvent.{type,delta,content}`; sub-types `text_delta`/`thinking_delta`/`toolcall_delta` carry `.delta` (string); `text_end`/`thinking_end` carry `.content` (string).
- `tool_execution_start|update|end` → `toolCallId`, `partialResult`/`result`.
- `message_end` → `message` (role/content/usage/model/stopReason/errorMessage); accumulate usage when `role==="assistant"`.
- `tool_result_end` → `message`.
- Final output = last assistant message's first `text` part.
- Failure = exitCode≠0 OR `stopReason ∈ {error,aborted}` OR abort signal.

**pi SDK API** (from `@earendil-works/pi-coding-agent` 0.75.4 `dist/core/extensions/types.d.ts`):
- `pi.registerCommand(name, { description?, getArgumentCompletions?, handler })` where `handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>`. `args` = raw string after command word.
- `pi.registerTool({ name, label, description, promptSnippet?, promptGuidelines?, parameters, execute, renderCall?, renderResult? })` where `execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult>` and `AgentToolResult = { content: ({type:"text",text}|...)[]; details: T; terminate?: boolean }`.
- `pi.on(event, handler)`; handler `(event, ctx) => Promise<R|void>|R|void`.
- `pi.appendEntry(customType, data)` — persists a session entry NOT sent to the LLM.
- `pi.sendMessage({customType, content, display, details?}, {triggerTurn?, deliverAs?})`; `pi.sendUserMessage(text, {deliverAs?})`.
- `pi.exec(command, args, { signal?, timeout?, cwd? }): Promise<{stdout, stderr, code, killed}>`.
- `ctx`: `cwd`, `hasUI`, `mode` (`"tui"|"rpc"|"json"|"print"`), `ui.notify(msg, "info"|"warning"|"error")`, `sessionManager.getBranch()/getEntries()`, `signal`.
- Command processing order: extension commands matched FIRST, before the `input` event. So `/hugotown-method approve` is a normal command invocation.
- Pause/resume MUST be decoupled: never block the handler on `ctx.ui.*` for an approval gate; persist + return, resume on a later command.

**wt CLI** (from `wt --help`): `wt switch --create <branch>`, `wt list --format=json`, `wt merge [target] --yes`, `wt remove [branch] --yes --force`. Global `-C <path>` sets working dir. JSON via `--format=json`.

---

## Section 0 — File Contract Map

Each row is ONE implementation unit (source + co-located `*.test.ts`). An agent building a unit MAY assume every other unit's exports already exist (file contract). Layers are ordered by dependency; within a layer, units are independent and parallelizable.

### Layer 0 — Scaffolding (no logic; no unit tests except schema)

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 0.1 | `package.json` | Manifest + pinned deps + `pi.extensions` | — | — |
| 0.2 | `tsconfig.json` | TS strict config (copy subagent) | — | — |
| 0.3 | `config.yml` | Default runtime config (concurrency, timeouts, panel keymap/theme) | — | — |
| 0.4a | `types.ts` | Workflow/node definition types | `NodeType`, `TriggerRule`, `ContextMode`, `JsonSchema`, `RetryConfig`, `LoopSpec`, `ApprovalSpec`, `ScriptSpec`, `NodeDef`, `WorkflowDef` | — |
| 0.4b | `runtime-types.ts` | Runtime/state/orchestration types | `NodeStatus`, `RunStatus`, `NodeState`, `RunState`, `NodeResult`, `SubContext`, `PiRunResult`, `ExecLike`, `RunDeps`, `RunCtx` | `types` |
| 0.5 | `constants.ts` | Static strings/signals | `QUESTION_PROHIBITION`, `DEFAULT_BLOCKED_TOOLS`, `COMPLETION_SIGNAL_DEFAULTS`, `BUILTIN_VAR_NAMES`, `STATE_ENTRY`, `CMD_NAME`, `DEFAULT_CONCURRENCY` | — |
| 0.6 | `schema.ts` | TypeBox schema for the `hugotown_method` tool params | `RunWorkflowParams` (TSchema) | `typebox` |

### Layer 1 — Pure logic (no IO; fully unit-tested)

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 1.1 | `lib/loader.ts` | Parse YAML text → `WorkflowDef` (no validation) | `parseWorkflow(yamlText: string): WorkflowDef` | `yaml`, `types` |
| 1.2 | `lib/validator.ts` | DAG + node-shape validation | `validateWorkflow(def: WorkflowDef): string \| null` | `types` |
| 1.3 | `lib/topo-sort.ts` | Topological layering | `toLayers(nodes: NodeDef[]): NodeDef[][]` | `types` |
| 1.4 | `lib/trigger-rule.ts` | Join semantics + skip decision | `shouldExecute(node: NodeDef, states: Record<string,NodeState>): boolean` | `types` |
| 1.5 | `lib/variable-sub.ts` | `$var` / `$id.output[.field]` substitution | `substitute(template: string, ctx: SubContext): string` | `types` |
| 1.6 | `lib/condition-eval.ts` | Evaluate `when:` expressions (safe, no eval) | `evaluateCondition(expr: string, ctx: SubContext): boolean` | `types`, `variable-sub` |
| 1.7 | `lib/output-schema.ts` | Validate/extract structured output vs JsonSchema | `enforceOutput(raw: string, schema: JsonSchema): { ok: true; data: unknown } \| { ok: false; error: string }` | `types` |
| 1.8 | `lib/semaphore.ts` | Counting semaphore (copy subagent) | `createSemaphore(limit: number): { acquire(): Promise<void>; release(): void }` | — |
| 1.9 | `lib/json-stream.ts` | Apply one NDJSON line to a `PiRunResult` | `applyJsonLine(result: PiRunResult, line: string): boolean`, `finalText(messages): string` | `types` |
| 1.10 | `lib/retry.ts` | Retry wrapper + error classification | `classifyError(e: string): "fatal"\|"transient"\|"unknown"`, `withRetry<T>(fn, cfg, classify): Promise<T>` | `types` |
| 1.11 | `lib/branch-name.ts` | Deterministic run branch name | `makeBranchName(workflow: string): string` | — |
| 1.12 | `lib/completion.ts` | Loop completion detection + tag strip | `detectSignal(output: string, until?: string): boolean`, `stripSignalTags(output: string): string` | — |
| 1.13 | `lib/format.ts` | Status icons + duration/number formatting | `statusIcon(s: NodeStatus): string`, `fmtDuration(ms: number): string` | `types` |
| 1.14 | `lib/summary.ts` | Build model-visible run summary text | `buildSummary(state: RunState): string` | `types`, `format` |
| 1.15 | `lib/script-detect.ts` | Inline-vs-named + runtime/ext resolution | `isInline(script: string): boolean`, `runtimeForFile(path: string): "bun"\|"uv"`, `buildScriptArgv(spec, code): string[]` | `types` |

### Layer 2 — IO / process (integration-tested, spawn real pi/wt where applicable)

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 2.1 | `lib/pi-invocation.ts` | Resolve pi binary + temp system-prompt file | `getPiInvocation(args: string[]): { command: string; args: string[] }`, `writeSystemPrompt(name, text): Promise<{dir,filePath}>`, `cleanupTemp(dir, filePath): void` | `node:*` |
| 2.2 | `lib/runner.ts` | Spawn one pi subprocess, stream NDJSON → `PiRunResult` | `runPi(opts: { provider; model; thinking; tools?: string[]; system: string; task: string; cwd: string; signal?: AbortSignal }): Promise<PiRunResult>` | `pi-invocation`, `json-stream`, `constants`, `types` |
| 2.3 | `lib/state.ts` | Load/save `RunState` JSON files | `saveRun(dir, state): void`, `loadRun(dir, id): RunState \| null`, `listRuns(dir): RunState[]` | `node:fs`, `types` |
| 2.4 | `lib/artifacts.ts` | Create per-run artifacts dir | `createArtifactsDir(home, id): string` | `node:fs` |
| 2.5 | `lib/wt.ts` | wt worktree ops via `exec` | `wtCreate(exec, branch, cwd): Promise<{path}>`, `wtMerge(exec, cwd): Promise<void>`, `wtRemove(exec, branch, cwd): Promise<void>`, `wtPath(exec, branch, cwd): Promise<string \| null>` | `types` |
| 2.6 | `lib/git-info.ts` | Detect base branch via exec | `detectBaseBranch(exec, cwd): Promise<string>` | `types` |
| 2.7 | `lib/discovery.ts` | Find workflow/command files (project > bundled) | `findWorkflow(name, dirs): string \| null`, `listWorkflows(dirs): {name,description}[]`, `findCommand(name, dirs): string \| null` | `node:fs`, `loader` |
| 2.8 | `lib/command-loader.ts` | Load `.md` command template text | `loadCommandText(name, dirs): string` | `discovery` |

### Layer 3 — Node handlers (one per node type; integration-tested)

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 3.1 | `nodes/prompt.ts` | Run a `prompt:` node | `runPrompt(node, rctx): Promise<NodeResult>` | `runner`, `variable-sub`, `output-schema`, `types` |
| 3.2 | `nodes/command.ts` | Run a `command:` node (load .md → prompt) | `runCommand(node, rctx): Promise<NodeResult>` | `command-loader`, `runner`, `variable-sub`, `output-schema`, `types` |
| 3.3 | `nodes/bash.ts` | Run a `bash:` node (env-injected vars, quoted outputs) | `runBash(node, rctx): Promise<NodeResult>` | `variable-sub`, `types` |
| 3.4 | `nodes/script.ts` | Run a `script:` node (bun/uv) | `runScript(node, rctx): Promise<NodeResult>` | `script-detect`, `variable-sub`, `types` |
| 3.5 | `nodes/loop.ts` | Run a `loop:` node (iterate until signal) | `runLoop(node, rctx): Promise<NodeResult>` | `runner`, `variable-sub`, `completion`, `types` |
| 3.6 | `nodes/approval.ts` | Signal a pause at an approval gate | `runApproval(node, rctx): NodeResult` (status `paused`) | `variable-sub`, `types` |
| 3.7 | `nodes/cancel.ts` | Cancel the run | `runCancel(node, rctx): NodeResult` (status `cancelled`) | `variable-sub`, `types` |
| 3.8 | `nodes/dispatch.ts` | Route a node to its handler by type | `nodeType(node): NodeType`, `dispatchNode(node, rctx): Promise<NodeResult>` | all `nodes/*`, `types` |

### Layer 4 — Orchestration

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 4.1 | `lib/sub-context.ts` | Build `SubContext` from RunState + builtins | `buildSubContext(state, deps): SubContext` | `types`, `constants` |
| 4.2 | `lib/dag-executor.ts` | Run layers, handle skip/retry/pause/cancel | `executeDag(def, state, deps): Promise<RunState>` | `topo-sort`, `trigger-rule`, `condition-eval`, `dispatch`, `retry`, `semaphore`, `sub-context`, `state`, `types` |
| 4.3 | `lib/run-controller.ts` | Start/resume a run end-to-end | `startRun(args, deps): Promise<RunState>`, `resumeRun(id, deps, approval?): Promise<RunState>` | `discovery`, `loader`, `validator`, `wt`, `git-info`, `artifacts`, `state`, `dag-executor`, `branch-name`, `types` |

### Layer 5 — Wiring + UI

| # | File | Responsibility | Exports (contract) | Depends on |
|---|------|----------------|--------------------|------------|
| 5.1 | `lib/deps.ts` | Build the injected `RunDeps` from pi/ctx | `makeDeps(pi, ctx): RunDeps` | `types` |
| 5.2 | `lib/config.ts` | Load `config.yml` with defaults | `loadConfig(path): AppConfig`, `parseConfig(text): AppConfig` | `yaml` |
| 5.3 | `lib/command-router.ts` | Parse `/hugotown-method` subcommands | `parseCommand(args: string): ParsedCommand` | `types` |
| 5.4 | `ui/shared.ts` | Status icons/labels for inline render | `nodeLine(id, state): string` | `format`, `types` |
| 5.5 | `ui/render-result.ts` | Tool/command result inline view | `renderRunResult(state, theme): Component` | `pi-tui`, `shared`, `types` |
| 5.6 | `index.ts` | Entry: registerCommand + registerTool + hooks | `default function (pi): void` | `command-router`, `run-controller`, `deps`, `config`, `schema`, `state`, `constants`, `ui/*` |

### Layer 6 — Bundled assets + integration suites (no new exports)

| # | File | Responsibility | Depends on |
|---|------|----------------|------------|
| 6.1 | `workflows/fix-issue.yaml` | Bundled: classify→investigate→implement→test→gate→PR/abort | engine |
| 6.2 | `workflows/feature-dev.yaml` | Bundled: plan→implement→test-loop→gate→PR | engine |
| 6.3 | `workflows/pr-review.yaml` | Bundled: fetch-diff→3 parallel reviews→synthesize→comment | engine |
| 6.4 | `commands/investigate-issue.md` | Bundled command template | engine |
| 6.5 | `commands/implement-feature.md` | Bundled command template | engine |
| 6.6 | `commands/review-code.md` | Bundled command template | engine |
| 6.7 | `tests/integration/runner.itest.ts` | Real pi spawn: mechanics + schema | `runner` |
| 6.8 | `tests/integration/dag-flow.itest.ts` | End-to-end DAG: bash/script/branch/loop/approval-resume | `run-controller` |
| 6.9 | `tests/integration/wt.itest.ts` | Real wt create/remove in a temp git repo | `wt` |

**Core data contracts (defined in `runtime-types.ts`, referenced everywhere):**

```typescript
export interface NodeResult {
  status: NodeStatus;            // completed | failed | skipped | cancelled | paused
  output: string;
  structured?: unknown;
  sessionId?: string;
  error?: string;
}

export interface ExecLike {     // matches pi.exec signature subset
  (command: string, args: string[], options?: { signal?: AbortSignal; timeout?: number; cwd?: string }):
    Promise<{ stdout: string; stderr: string; code: number; killed: boolean }>;
}

export interface RunDeps {
  exec: ExecLike;               // pi.exec
  notify: (msg: string, level?: "info" | "warning" | "error") => void;
  emit: (state: RunState) => void;          // progress callback (TUI)
  home: string;                 // <project>/.hugotown
  bundledDir: string;           // extension dir
  projectDir: string;           // ctx.cwd
  signal?: AbortSignal;
  defaultModel?: string;
  defaultProvider?: string;
}

export interface RunCtx {        // passed to every node handler
  node: NodeDef;
  state: RunState;
  deps: RunDeps;
  sub: SubContext;
  cwd: string;                  // worktree path or projectDir
}
```

---

## Section A — Scaffolding (Layer 0)

> Type/config files have no runtime behavior; their "test" is `tsc --noEmit`. `schema.ts` has a real unit test. Work directory for all paths: `~/.pi/agent/extensions/hugotown-method/`.

### Task A1: package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: Write the manifest**

```json
{
  "name": "hugotown-method",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "pi": { "extensions": ["./index.ts"] },
  "scripts": { "test": "bun test", "typecheck": "tsc --noEmit" },
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

- [ ] **Step 2: Install + verify**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold hugotown-method package manifest"
```

### Task A2: tsconfig.json

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1: Write the config** (verbatim copy of the verified subagent config)

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

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json && git commit -m "chore: add tsconfig"
```

### Task A3: types.ts (definition types)

**Files:**
- Create: `types.ts`

- [ ] **Step 1: Write the definition types**

```typescript
// types.ts — Workflow and node DEFINITION types (parsed from YAML).
export type NodeType = "prompt" | "command" | "bash" | "script" | "loop" | "approval" | "cancel";
export type TriggerRule = "all_success" | "one_success" | "all_done" | "none_failed_min_one_success";
export type ContextMode = "fresh" | "shared";
export type Thinking = "low" | "medium" | "high";

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  items?: JsonSchema;
}

export interface RetryConfig {
  max_attempts?: number; // default 2, range 1-5
  delay_ms?: number; // default 3000
  on_error?: "transient" | "all";
}

export interface LoopSpec {
  prompt: string;
  until?: string;
  until_bash?: string;
  max_iterations: number;
  fresh_context?: boolean;
}

export interface ApprovalSpec {
  message: string;
  capture_response?: boolean;
  on_reject?: "abort" | "retry";
}

export interface ScriptSpec {
  inline?: string;
  file?: string;
  runtime?: "bun" | "uv"; // default bun
  deps?: string[]; // uv only
  timeout?: number;
}

export interface NodeDef {
  id: string;
  depends_on?: string[];
  when?: string;
  trigger_rule?: TriggerRule;
  context?: ContextMode;
  model?: string;
  provider?: string;
  thinking?: Thinking;
  output_format?: JsonSchema;
  allowed_tools?: string[];
  denied_tools?: string[];
  retry?: RetryConfig;
  always_run?: boolean;
  timeout?: number;
  prompt?: string;
  command?: string;
  bash?: string;
  script?: ScriptSpec;
  loop?: LoopSpec;
  approval?: ApprovalSpec;
  cancel?: string;
}

export interface WorkflowDef {
  name: string;
  description: string;
  worktree?: boolean;
  model?: string;
  provider?: string;
  concurrency?: number;
  persist_sessions?: boolean;
  nodes: NodeDef[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add types.ts && git commit -m "feat: add workflow definition types"
```

### Task A4: runtime-types.ts (state + orchestration types)

**Files:**
- Create: `runtime-types.ts`

- [ ] **Step 1: Write the runtime types**

```typescript
// runtime-types.ts — Runtime state and orchestration types.
import type { NodeDef } from "./types.ts";

export type NodeStatus =
  | "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled" | "paused";
export type RunStatus = "running" | "completed" | "failed" | "cancelled" | "paused";

export interface NodeState {
  status: NodeStatus;
  output: string;
  structured?: unknown;
  started_at?: string;
  completed_at?: string;
  session_id?: string;
  attempts?: number;
  error?: string;
}

export interface RunState {
  id: string;
  workflow: string;
  arguments: string;
  status: RunStatus;
  worktree?: { branch: string; path: string };
  artifacts_dir: string;
  base_branch: string;
  started_at: string;
  completed_at?: string;
  paused_node?: string;
  nodes: Record<string, NodeState>;
}

export interface NodeResult {
  status: NodeStatus;
  output: string;
  structured?: unknown;
  sessionId?: string;
  error?: string;
}

export interface SubContext {
  builtins: Record<string, string>;
  nodeOutputs: Record<string, string>;
  nodeStructured: Record<string, unknown>;
}

export interface PiRunResult {
  output: string;
  status: "ok" | "failed";
  exitCode: number;
  stderr: string;
  sessionId?: string;
  stopReason?: string;
  errorMessage?: string;
  messages: unknown[];
}

export interface ExecResult { stdout: string; stderr: string; code: number; killed: boolean; }
export type ExecLike = (
  command: string,
  args: string[],
  options?: { signal?: AbortSignal; timeout?: number; cwd?: string },
) => Promise<ExecResult>;

export interface RunDeps {
  exec: ExecLike;
  notify: (msg: string, level?: "info" | "warning" | "error") => void;
  emit: (state: RunState) => void;
  home: string;
  bundledDir: string;
  projectDir: string;
  signal?: AbortSignal;
  defaultModel?: string;
  defaultProvider?: string;
}

export interface RunCtx {
  node: NodeDef;
  state: RunState;
  deps: RunDeps;
  sub: SubContext;
  cwd: string;
}
```

- [ ] **Step 2: Typecheck** — Run: `npx tsc --noEmit` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add runtime-types.ts && git commit -m "feat: add runtime state types"
```

### Task A5: constants.ts

**Files:**
- Create: `constants.ts`

- [ ] **Step 1: Write the constants**

```typescript
// constants.ts — Static values shared across the extension.
export const CMD_NAME = "hugotown-method";
export const STATE_ENTRY = "hugotown-method-state";
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_BLOCKED_TOOLS = ["ask_user_question"];
export const COMPLETION_SIGNAL_DEFAULTS = ["ALL_TASKS_COMPLETE", "APPROVED", "DONE", "COMPLETE"];
export const BUILTIN_VAR_NAMES = [
  "ARGUMENTS", "ARTIFACTS_DIR", "BASE_BRANCH", "WORKFLOW_ID",
  "RUN_DIR", "DOCS_DIR", "REJECTION_REASON", "LOOP_PREV_OUTPUT", "LOOP_USER_INPUT",
];
export const QUESTION_PROHIBITION = [
  "## Constraint",
  "You are FORBIDDEN from asking the user any questions; the ask_user_question tool is disabled for you.",
  "When something is ambiguous, make the most reasonable assumption, state it explicitly, and proceed.",
  "Never stop to ask.",
].join("\n");
```

- [ ] **Step 2: Typecheck** — Run: `npx tsc --noEmit` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add constants.ts && git commit -m "feat: add constants"
```

### Task A6: config.yml

**Files:**
- Create: `config.yml`

- [ ] **Step 1: Write the default config**

```yaml
# hugotown-method configuration. Edit and restart pi to apply.
engine:
  concurrency: 4 # max parallel nodes per layer
  node_timeout_ms: 600000 # default per-node timeout (10 min)
  loop_idle_ms: 1800000 # per-iteration loop timeout (30 min)
# Inline render colors (Tokyo Night defaults). Uncomment to override.
# theme:
#   fg: "#c0caf5"
#   green: "#9ece6a"
#   red: "#f7768e"
#   yellow: "#e0af68"
```

- [ ] **Step 2: Commit**

```bash
git add config.yml && git commit -m "chore: add default config.yml"
```

### Task A7: schema.ts (with unit test)

**Files:**
- Create: `schema.ts`
- Test: `schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// schema.test.ts
import { test, expect } from "bun:test";
import { Value } from "typebox/value";
import { RunWorkflowParams } from "./schema.ts";

test("accepts a valid flow param", () => {
  expect(Value.Check(RunWorkflowParams, { flow: "fix-issue" })).toBe(true);
});

test("accepts flow + arguments", () => {
  expect(Value.Check(RunWorkflowParams, { flow: "fix-issue", arguments: "#42" })).toBe(true);
});

test("rejects missing flow", () => {
  expect(Value.Check(RunWorkflowParams, { arguments: "x" })).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test schema.test.ts`
Expected: FAIL with "Cannot find module './schema.ts'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// schema.ts — TypeBox parameter schema for the hugotown_method tool.
import { Type } from "typebox";

export const RunWorkflowParams = Type.Object({
  flow: Type.String({
    description: "Workflow name; resolved from .hugotown/workflows/<flow>.yaml or bundled.",
  }),
  arguments: Type.Optional(
    Type.String({ description: "Free-form input passed to the workflow as $ARGUMENTS." }),
  ),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add schema.ts schema.test.ts && git commit -m "feat: add tool param schema"
```

---

## Section B — Pure Logic (Layer 1)

> All units are pure (no IO). Each task: write failing test → verify fail → implement → verify pass → commit. Run tests with `bun test <file>`.

### Task B1: lib/loader.ts

**Files:** Create `lib/loader.ts`, Test `lib/loader.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/loader.test.ts
import { test, expect } from "bun:test";
import { parseWorkflow } from "./loader.ts";

test("parses a minimal workflow", () => {
  const def = parseWorkflow('name: w\ndescription: d\nnodes:\n  - id: a\n    bash: "echo hi"');
  expect(def.name).toBe("w");
  expect(def.nodes).toHaveLength(1);
  expect(def.nodes[0].id).toBe("a");
});

test("throws when name missing", () => {
  expect(() => parseWorkflow('description: d\nnodes:\n  - id: a\n    bash: x')).toThrow(/name/);
});

test("throws when nodes empty", () => {
  expect(() => parseWorkflow("name: w\ndescription: d\nnodes: []")).toThrow(/nodes/);
});
```

- [ ] **Step 2: Run → FAIL** (`bun test lib/loader.test.ts`) — "Cannot find module".

- [ ] **Step 3: Implement**

```typescript
// lib/loader.ts — Parse workflow YAML text into a WorkflowDef (structural only).
import { parse } from "yaml";
import type { WorkflowDef } from "../types.ts";

export function parseWorkflow(yamlText: string): WorkflowDef {
  const raw = parse(yamlText);
  if (!raw || typeof raw !== "object") throw new Error("Workflow must be a YAML object");
  const def = raw as Partial<WorkflowDef>;
  if (typeof def.name !== "string") throw new Error("Workflow 'name' is required");
  if (typeof def.description !== "string") throw new Error("Workflow 'description' is required");
  if (!Array.isArray(def.nodes) || def.nodes.length === 0) {
    throw new Error("Workflow 'nodes' must be a non-empty array");
  }
  return def as WorkflowDef;
}
```

- [ ] **Step 4: Run → PASS** (`bun test lib/loader.test.ts`).
- [ ] **Step 5: Commit** — `git add lib/loader.ts lib/loader.test.ts && git commit -m "feat: workflow YAML loader"`

### Task B2: lib/validator.ts

**Files:** Create `lib/validator.ts`, Test `lib/validator.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/validator.test.ts
import { test, expect } from "bun:test";
import { validateWorkflow } from "./validator.ts";
import type { WorkflowDef } from "../types.ts";

const wf = (nodes: WorkflowDef["nodes"]): WorkflowDef => ({ name: "w", description: "d", nodes });

test("accepts a valid DAG", () => {
  expect(validateWorkflow(wf([
    { id: "a", bash: "x" }, { id: "b", bash: "y", depends_on: ["a"] },
  ]))).toBeNull();
});

test("rejects duplicate ids", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x" }, { id: "a", bash: "y" }]))).toMatch(/Duplicate/);
});

test("rejects two type fields", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x", prompt: "p" }]))).toMatch(/exactly one/);
});

test("rejects unknown dependency", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x", depends_on: ["z"] }]))).toMatch(/unknown/);
});

test("rejects cycles", () => {
  expect(validateWorkflow(wf([
    { id: "a", bash: "x", depends_on: ["b"] }, { id: "b", bash: "y", depends_on: ["a"] },
  ]))).toMatch(/cycle/);
});

test("rejects retry on loop node", () => {
  expect(validateWorkflow(wf([
    { id: "a", loop: { prompt: "p", max_iterations: 1 }, retry: { max_attempts: 2 } },
  ]))).toMatch(/Loop/);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/validator.ts — Validate node shape + DAG integrity. Returns error message or null.
import type { WorkflowDef, NodeDef, NodeType } from "../types.ts";

const TYPE_KEYS: NodeType[] = ["prompt", "command", "bash", "script", "loop", "approval", "cancel"];

function typeCount(node: NodeDef): number {
  return TYPE_KEYS.filter((k) => (node as Record<string, unknown>)[k] !== undefined).length;
}

function findCycle(nodes: NodeDef[]): string[] | null {
  const adj = new Map(nodes.map((n) => [n.id, n.depends_on ?? []]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1); stack.push(id);
    for (const dep of adj.get(id) ?? []) {
      const s = state.get(dep) ?? 0;
      if (s === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (s === 0) { const c = visit(dep); if (c) return c; }
    }
    stack.pop(); state.set(id, 2); return null;
  };
  for (const n of nodes) if ((state.get(n.id) ?? 0) === 0) { const c = visit(n.id); if (c) return c; }
  return null;
}

export function validateWorkflow(def: WorkflowDef): string | null {
  const ids = new Set<string>();
  for (const n of def.nodes) {
    if (!n.id) return "Every node needs an 'id'";
    if (ids.has(n.id)) return `Duplicate node id "${n.id}"`;
    ids.add(n.id);
    const tc = typeCount(n);
    if (tc !== 1) return `Node "${n.id}" must have exactly one type field (has ${tc})`;
    if (n.loop && n.retry) return `Loop node "${n.id}" cannot use retry`;
  }
  for (const n of def.nodes) for (const dep of n.depends_on ?? []) {
    if (dep === n.id) return `Node "${n.id}" cannot depend on itself`;
    if (!ids.has(dep)) return `Node "${n.id}" depends on unknown node "${dep}"`;
  }
  const cycle = findCycle(def.nodes);
  return cycle ? `Dependency cycle: ${cycle.join(" -> ")}` : null;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/validator.ts lib/validator.test.ts && git commit -m "feat: DAG validator"`

### Task B3: lib/topo-sort.ts

**Files:** Create `lib/topo-sort.ts`, Test `lib/topo-sort.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/topo-sort.test.ts
import { test, expect } from "bun:test";
import { toLayers } from "./topo-sort.ts";

test("groups independent nodes into one layer", () => {
  const layers = toLayers([{ id: "a", bash: "x" }, { id: "b", bash: "y" }]);
  expect(layers).toHaveLength(1);
  expect(layers[0].map((n) => n.id).sort()).toEqual(["a", "b"]);
});

test("orders by dependency", () => {
  const layers = toLayers([
    { id: "c", bash: "z", depends_on: ["a", "b"] },
    { id: "a", bash: "x" }, { id: "b", bash: "y" },
  ]);
  expect(layers.map((l) => l.map((n) => n.id).sort())).toEqual([["a", "b"], ["c"]]);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/topo-sort.ts — Kahn-style topological layering (assumes acyclic; validator runs first).
import type { NodeDef } from "../types.ts";

export function toLayers(nodes: NodeDef[]): NodeDef[][] {
  const indeg = new Map(nodes.map((n) => [n.id, (n.depends_on ?? []).length]));
  const layers: NodeDef[][] = [];
  const done = new Set<string>();
  let frontier = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  while (frontier.length > 0) {
    layers.push(frontier);
    for (const n of frontier) done.add(n.id);
    frontier = nodes.filter(
      (n) => !done.has(n.id) && (n.depends_on ?? []).every((d) => done.has(d)),
    );
  }
  return layers;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/topo-sort.ts lib/topo-sort.test.ts && git commit -m "feat: topological layering"`

### Task B4: lib/trigger-rule.ts

**Files:** Create `lib/trigger-rule.ts`, Test `lib/trigger-rule.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/trigger-rule.test.ts
import { test, expect } from "bun:test";
import { shouldExecute } from "./trigger-rule.ts";
import type { NodeState } from "../runtime-types.ts";

const st = (m: Record<string, string>): Record<string, NodeState> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { status: v as NodeState["status"], output: "" }]));

test("no deps always runs", () => {
  expect(shouldExecute({ id: "a", bash: "x" }, {})).toBe(true);
});

test("all_success requires every dep completed", () => {
  const n = { id: "c", bash: "x", depends_on: ["a", "b"] };
  expect(shouldExecute(n, st({ a: "completed", b: "completed" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "completed", b: "failed" }))).toBe(false);
});

test("none_failed_min_one_success allows skipped deps", () => {
  const n = { id: "c", bash: "x", depends_on: ["a", "b"], trigger_rule: "none_failed_min_one_success" as const };
  expect(shouldExecute(n, st({ a: "completed", b: "skipped" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "failed", b: "skipped" }))).toBe(false);
});

test("all_done waits for terminal states", () => {
  const n = { id: "c", bash: "x", depends_on: ["a"], trigger_rule: "all_done" as const };
  expect(shouldExecute(n, st({ a: "failed" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "running" }))).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/trigger-rule.ts — Join semantics: should a node run given its deps' states?
import type { NodeDef } from "../types.ts";
import type { NodeState } from "../runtime-types.ts";

export function shouldExecute(node: NodeDef, states: Record<string, NodeState>): boolean {
  const deps = node.depends_on ?? [];
  if (deps.length === 0) return true;
  const ss = deps.map((d) => states[d]?.status ?? "pending");
  const ok = (s: string) => s === "completed";
  const failed = (s: string) => s === "failed" || s === "cancelled";
  const done = (s: string) => ok(s) || failed(s) || s === "skipped";
  switch (node.trigger_rule ?? "all_success") {
    case "one_success": return ss.some(ok);
    case "all_done": return ss.every(done);
    case "none_failed_min_one_success": return !ss.some(failed) && ss.some(ok);
    default: return ss.every(ok);
  }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/trigger-rule.ts lib/trigger-rule.test.ts && git commit -m "feat: trigger-rule join semantics"`

### Task B5: lib/variable-sub.ts

**Files:** Create `lib/variable-sub.ts`, Test `lib/variable-sub.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/variable-sub.test.ts
import { test, expect } from "bun:test";
import { substitute } from "./variable-sub.ts";
import type { SubContext } from "../runtime-types.ts";

const ctx: SubContext = {
  builtins: { ARGUMENTS: "#42", ARTIFACTS_DIR: "/tmp/a" },
  nodeOutputs: { "classify": '{"type":"bug"}', "review-gate": "approved" },
  nodeStructured: { "classify": { type: "bug", severity: "high" } },
};

test("substitutes builtins", () => {
  expect(substitute("issue $ARGUMENTS in $ARTIFACTS_DIR", ctx)).toBe("issue #42 in /tmp/a");
});

test("substitutes node output (incl. hyphenated id)", () => {
  expect(substitute("gate=$review-gate.output", ctx)).toBe("gate=approved");
});

test("substitutes structured field", () => {
  expect(substitute("t=$classify.output.severity", ctx)).toBe("t=high");
});

test("leaves unknown vars intact", () => {
  expect(substitute("$UNKNOWN", ctx)).toBe("$UNKNOWN");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/variable-sub.ts — Substitute $var, $id.output and $id.output.field tokens.
import type { SubContext } from "../runtime-types.ts";

export function substitute(template: string, ctx: SubContext): string {
  let out = template.replace(/\$([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)/g, (m, id, field) => {
    const s = ctx.nodeStructured[id];
    if (s && typeof s === "object" && field in (s as object)) {
      const v = (s as Record<string, unknown>)[field];
      return v == null ? "" : String(v);
    }
    return m;
  });
  out = out.replace(/\$([A-Za-z0-9_-]+)\.output\b/g, (m, id) =>
    id in ctx.nodeOutputs ? ctx.nodeOutputs[id] : m,
  );
  out = out.replace(/\$([A-Z_]+)\b/g, (m, name) =>
    name in ctx.builtins ? ctx.builtins[name] : m,
  );
  return out;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/variable-sub.ts lib/variable-sub.test.ts && git commit -m "feat: variable substitution"`

### Task B6: lib/condition-eval.ts

**Files:** Create `lib/condition-eval.ts`, Test `lib/condition-eval.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/condition-eval.test.ts
import { test, expect } from "bun:test";
import { evaluateCondition } from "./condition-eval.ts";
import type { SubContext } from "../runtime-types.ts";

const ctx: SubContext = {
  builtins: {},
  nodeOutputs: { gate: "approved", score: "85" },
  nodeStructured: { classify: { type: "bug" } },
};

test("string equality", () => {
  expect(evaluateCondition("$gate.output == 'approved'", ctx)).toBe(true);
  expect(evaluateCondition("$gate.output == 'rejected'", ctx)).toBe(false);
});

test("structured field equality", () => {
  expect(evaluateCondition("$classify.output.type == 'bug'", ctx)).toBe(true);
});

test("numeric comparison", () => {
  expect(evaluateCondition("$score.output > '80'", ctx)).toBe(true);
  expect(evaluateCondition("$score.output < '80'", ctx)).toBe(false);
});

test("compound && binds tighter than ||", () => {
  expect(evaluateCondition("$gate.output == 'x' || $score.output >= '85'", ctx)).toBe(true);
});

test("invalid expression fails closed", () => {
  expect(evaluateCondition("$missing.output >", ctx)).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/condition-eval.ts — Safe when: evaluator. ops: == != > < >= <= && ||. Fail-closed.
import type { SubContext } from "../runtime-types.ts";
import { substitute } from "./variable-sub.ts";

const unquote = (s: string) => s.replace(/^['"]|['"]$/g, "");

function cmp(a: string, op: string, b: string): boolean {
  const na = Number(a), nb = Number(b);
  const num = a.trim() !== "" && b.trim() !== "" && !Number.isNaN(na) && !Number.isNaN(nb);
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">": return num && na > nb;
    case "<": return num && na < nb;
    case ">=": return num && na >= nb;
    case "<=": return num && na <= nb;
    default: return false;
  }
}

function atom(expr: string, ctx: SubContext): boolean {
  const m = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) { const v = substitute(expr.trim(), ctx); return v !== "" && v !== "false"; }
  return cmp(unquote(substitute(m[1].trim(), ctx)), m[2], unquote(substitute(m[3].trim(), ctx)));
}

export function evaluateCondition(expr: string, ctx: SubContext): boolean {
  try {
    return expr.split("||").some((or) => or.split("&&").every((a) => atom(a.trim(), ctx)));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/condition-eval.ts lib/condition-eval.test.ts && git commit -m "feat: when condition evaluator"`

### Task B7: lib/output-schema.ts

**Files:** Create `lib/output-schema.ts`, Test `lib/output-schema.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/output-schema.test.ts
import { test, expect } from "bun:test";
import { enforceOutput } from "./output-schema.ts";
import type { JsonSchema } from "../types.ts";

const schema: JsonSchema = {
  type: "object",
  properties: { type: { type: "string" } },
  required: ["type"],
};

test("accepts raw JSON", () => {
  const r = enforceOutput('{"type":"bug"}', schema);
  expect(r.ok).toBe(true);
  if (r.ok) expect((r.data as { type: string }).type).toBe("bug");
});

test("extracts JSON from fenced block", () => {
  const r = enforceOutput("Here:\n```json\n{\"type\":\"feat\"}\n```", schema);
  expect(r.ok).toBe(true);
});

test("rejects missing required field", () => {
  const r = enforceOutput('{"x":1}', schema);
  expect(r.ok).toBe(false);
});

test("rejects non-JSON", () => {
  expect(enforceOutput("not json", schema).ok).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/output-schema.ts — Best-effort structured-output validation against a JsonSchema.
import type { JsonSchema } from "../types.ts";

type Result = { ok: true; data: unknown } | { ok: false; error: string };

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : raw).trim());
}

function checkType(v: unknown, schema: JsonSchema): boolean {
  switch (schema.type) {
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    case "array": return Array.isArray(v);
    case "number": case "integer": return typeof v === "number";
    case "boolean": return typeof v === "boolean";
    case "string": return typeof v === "string";
    default: return true;
  }
}

export function enforceOutput(raw: string, schema: JsonSchema): Result {
  let data: unknown;
  try { data = extractJson(raw); } catch { return { ok: false, error: "Output is not valid JSON" }; }
  if (!checkType(data, schema)) return { ok: false, error: `Expected ${schema.type}` };
  for (const req of schema.required ?? []) {
    if (!(req in (data as Record<string, unknown>))) return { ok: false, error: `Missing field "${req}"` };
  }
  return { ok: true, data };
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/output-schema.ts lib/output-schema.test.ts && git commit -m "feat: structured output validation"`

### Task B8: lib/semaphore.ts

**Files:** Create `lib/semaphore.ts`, Test `lib/semaphore.test.ts` (verified copy of subagent's semaphore)

- [ ] **Step 1: Failing test**

```typescript
// lib/semaphore.test.ts
import { test, expect } from "bun:test";
import { createSemaphore } from "./semaphore.ts";

test("limits concurrency", async () => {
  const sem = createSemaphore(2);
  let active = 0, peak = 0;
  const task = async () => {
    await sem.acquire();
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--; sem.release();
  };
  await Promise.all([task(), task(), task(), task()]);
  expect(peak).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/semaphore.ts — Counting semaphore (verified pattern from subagent).
export interface Semaphore { acquire(): Promise<void>; release(): void; }

export function createSemaphore(limit: number): Semaphore {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < limit) { active++; return Promise.resolve(); }
      return new Promise<void>((r) => waiters.push(r)).then(() => { active++; });
    },
    release(): void { active--; waiters.shift()?.(); },
  };
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/semaphore.ts lib/semaphore.test.ts && git commit -m "feat: concurrency semaphore"`

---

### Task B9: lib/json-stream.ts

**Files:** Create `lib/json-stream.ts`, Test `lib/json-stream.test.ts` (adapts the verified subagent NDJSON parser)

- [ ] **Step 1: Failing test**

```typescript
// lib/json-stream.test.ts
import { test, expect } from "bun:test";
import { applyJsonLine, finalText } from "./json-stream.ts";
import type { PiRunResult } from "../runtime-types.ts";

const empty = (): PiRunResult => ({ output: "", status: "ok", exitCode: 0, stderr: "", messages: [] });

test("accumulates text_delta", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hel" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "lo" } }));
  expect(r.output).toBe("Hello");
});

test("final output from message_end assistant text", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Final" }] } }));
  expect(r.output).toBe("Final");
});

test("captures stopReason error", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "boom" } }));
  expect(r.stopReason).toBe("error");
  expect(r.errorMessage).toBe("boom");
});

test("ignores malformed lines", () => {
  const r = empty();
  expect(applyJsonLine(r, "not json")).toBe(false);
});

test("finalText prefers last assistant text", () => {
  expect(finalText([{ role: "assistant", content: [{ type: "text", text: "A" }] }] as never)).toBe("A");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/json-stream.ts — Apply one NDJSON line from `pi --mode json` to a PiRunResult.
import type { PiRunResult } from "../runtime-types.ts";

interface SubMsg {
  role: string;
  content: Array<{ type: string; text?: string }>;
  stopReason?: string;
  errorMessage?: string;
}

export function finalText(messages: SubMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") for (const p of m.content) if (p.type === "text") return p.text ?? "";
  }
  return "";
}

function deltaStr(evt: { type?: string; delta?: unknown; content?: unknown }): string | undefined {
  if (evt.type === "text_delta") return typeof evt.delta === "string" ? evt.delta : undefined;
  if (evt.type === "text_end") return typeof evt.content === "string" ? evt.content : undefined;
  return undefined;
}

export function applyJsonLine(result: PiRunResult, line: string): boolean {
  if (!line.trim()) return false;
  let ev: { type?: string; message?: SubMsg; assistantMessageEvent?: { type?: string; delta?: unknown; content?: unknown } };
  try { ev = JSON.parse(line); } catch { return false; }
  if (ev.type === "message_update" && ev.assistantMessageEvent) {
    const d = deltaStr(ev.assistantMessageEvent);
    if (d) { result.output += d; return true; }
    return false;
  }
  if (ev.message && (ev.type === "message_end" || ev.type === "tool_result_end")) {
    (result.messages as SubMsg[]).push(ev.message);
    if (ev.type === "message_end" && ev.message.role === "assistant") {
      if (ev.message.stopReason) result.stopReason = ev.message.stopReason;
      if (ev.message.errorMessage) result.errorMessage = ev.message.errorMessage;
    }
    result.output = finalText(result.messages as SubMsg[]) || result.output;
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/json-stream.ts lib/json-stream.test.ts && git commit -m "feat: NDJSON stream parser"`

### Task B10: lib/retry.ts

**Files:** Create `lib/retry.ts`, Test `lib/retry.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/retry.test.ts
import { test, expect } from "bun:test";
import { classifyError, withRetry } from "./retry.ts";

test("classifies errors", () => {
  expect(classifyError("Permission denied")).toBe("fatal");
  expect(classifyError("process exited with code 1")).toBe("transient");
  expect(classifyError("weird thing")).toBe("unknown");
});

test("retries transient then succeeds", async () => {
  let n = 0;
  const r = await withRetry(async () => {
    if (n++ < 1) throw new Error("network timeout");
    return "ok";
  }, { max_attempts: 2, delay_ms: 1000 }, (k) => k === "transient");
  expect(r).toBe("ok");
  expect(n).toBe(2);
});

test("does not retry fatal", async () => {
  let n = 0;
  await expect(withRetry(async () => { n++; throw new Error("unauthorized"); },
    { max_attempts: 3, delay_ms: 1000 }, (k) => k !== "fatal")).rejects.toThrow();
  expect(n).toBe(1);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/retry.ts — Error classification + retry wrapper with exponential backoff.
import type { RetryConfig } from "../types.ts";

export function classifyError(e: string): "fatal" | "transient" | "unknown" {
  const s = e.toLowerCase();
  if (/auth|permission denied|credit|unauthorized|forbidden/.test(s)) return "fatal";
  if (/exited with code|rate limit|timeout|network|econn|socket/.test(s)) return "transient";
  return "unknown";
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  cfg: RetryConfig | undefined,
  isRetryable: (kind: "fatal" | "transient" | "unknown") => boolean,
): Promise<T> {
  const max = Math.min(Math.max(cfg?.max_attempts ?? 2, 1), 5);
  const base = Math.min(Math.max(cfg?.delay_ms ?? 3000, 1000), 60000);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= max; attempt++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      const kind = classifyError(e instanceof Error ? e.message : String(e));
      if (kind === "fatal" || !isRetryable(kind) || attempt === max) break;
      await new Promise((r) => setTimeout(r, base * 2 ** attempt));
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/retry.ts lib/retry.test.ts && git commit -m "feat: retry with error classification"`

### Task B11: lib/branch-name.ts

**Files:** Create `lib/branch-name.ts`, Test `lib/branch-name.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/branch-name.test.ts
import { test, expect } from "bun:test";
import { makeBranchName } from "./branch-name.ts";

test("produces a slugged, prefixed, unique branch", () => {
  const b = makeBranchName("Fix Issue!");
  expect(b).toMatch(/^hugotown\/fix-issue-[a-z0-9]{6}$/);
});

test("two calls differ", () => {
  expect(makeBranchName("w")).not.toBe(makeBranchName("w"));
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/branch-name.ts — Deterministic-prefix, unique-suffix run branch name.
export function makeBranchName(workflow: string): string {
  const slug = workflow.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `hugotown/${slug}-${hash}`;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/branch-name.ts lib/branch-name.test.ts && git commit -m "feat: run branch naming"`

### Task B12: lib/completion.ts

**Files:** Create `lib/completion.ts`, Test `lib/completion.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/completion.test.ts
import { test, expect } from "bun:test";
import { detectSignal, stripSignalTags } from "./completion.ts";

test("detects <promise> tag matching until", () => {
  expect(detectSignal("work done\n<promise>COMPLETE</promise>", "COMPLETE")).toBe(true);
  expect(detectSignal("<promise>NOPE</promise>", "COMPLETE")).toBe(false);
});

test("detects default signal without until", () => {
  expect(detectSignal("all good\n<promise>DONE</promise>")).toBe(true);
});

test("detects trailing plain signal", () => {
  expect(detectSignal("finished\nCOMPLETE", "COMPLETE")).toBe(true);
});

test("strips promise tags", () => {
  expect(stripSignalTags("text\n<promise>COMPLETE</promise>")).toBe("text");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/completion.ts — Loop completion-signal detection + tag stripping.
import { COMPLETION_SIGNAL_DEFAULTS } from "../constants.ts";

const TAG = /<promise>\s*([\s\S]*?)\s*<\/promise>/i;

export function detectSignal(output: string, until?: string): boolean {
  const target = (until ?? "").trim();
  const tag = output.match(TAG);
  if (tag) {
    const val = tag[1].trim().toLowerCase();
    if (target) return val === target.toLowerCase();
    return COMPLETION_SIGNAL_DEFAULTS.some((s) => s.toLowerCase() === val);
  }
  const signals = target ? [target] : COMPLETION_SIGNAL_DEFAULTS;
  const body = output.trim().toLowerCase();
  const tail = body.split("\n").pop()?.trim() ?? "";
  return signals.some((s) => tail === s.toLowerCase() || body.endsWith(s.toLowerCase()));
}

export function stripSignalTags(output: string): string {
  return output.replace(/<promise>[\s\S]*?<\/promise>/gi, "").trim();
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/completion.ts lib/completion.test.ts && git commit -m "feat: loop completion detection"`

### Task B13: lib/format.ts

**Files:** Create `lib/format.ts`, Test `lib/format.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/format.test.ts
import { test, expect } from "bun:test";
import { statusIcon, fmtDuration } from "./format.ts";

test("maps statuses to icons", () => {
  expect(statusIcon("completed")).toBe("✓");
  expect(statusIcon("failed")).toBe("✗");
});

test("formats durations", () => {
  expect(fmtDuration(500)).toBe("500ms");
  expect(fmtDuration(2500)).toBe("2.5s");
  expect(fmtDuration(65000)).toBe("1m5s");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/format.ts — Status icons + duration formatting for inline rendering.
import type { NodeStatus } from "../runtime-types.ts";

const ICONS: Record<NodeStatus, string> = {
  pending: "○", running: "◐", completed: "✓",
  failed: "✗", skipped: "–", cancelled: "⊘", paused: "⏸",
};

export function statusIcon(s: NodeStatus): string { return ICONS[s] ?? "?"; }

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}m${Math.round(sec % 60)}s`;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/format.ts lib/format.test.ts && git commit -m "feat: status/duration formatters"`

### Task B14: lib/summary.ts

**Files:** Create `lib/summary.ts`, Test `lib/summary.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/summary.test.ts
import { test, expect } from "bun:test";
import { buildSummary } from "./summary.ts";
import type { RunState } from "../runtime-types.ts";

const state: RunState = {
  id: "1", workflow: "fix-issue", arguments: "", status: "paused",
  artifacts_dir: "/tmp", base_branch: "main", started_at: "t",
  paused_node: "gate",
  nodes: {
    classify: { status: "completed", output: "bug\nextra" },
    gate: { status: "paused", output: "" },
  },
};

test("summarizes nodes + pause hint", () => {
  const s = buildSummary(state);
  expect(s).toContain('Workflow "fix-issue" — paused');
  expect(s).toContain("✓ classify: completed — bug");
  expect(s).toContain('Paused at "gate"');
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/summary.ts — Build the model-visible run summary text.
import type { RunState } from "../runtime-types.ts";
import { statusIcon } from "./format.ts";

export function buildSummary(state: RunState): string {
  const lines = [`Workflow "${state.workflow}" — ${state.status}`];
  for (const [id, n] of Object.entries(state.nodes)) {
    const head = n.output.split("\n")[0]?.slice(0, 80) ?? "";
    lines.push(`${statusIcon(n.status)} ${id}: ${n.status}${head ? ` — ${head}` : ""}`);
  }
  if (state.paused_node) {
    lines.push(`Paused at "${state.paused_node}". Use /hugotown-method approve|reject.`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/summary.ts lib/summary.test.ts && git commit -m "feat: run summary builder"`

### Task B15: lib/script-detect.ts

**Files:** Create `lib/script-detect.ts`, Test `lib/script-detect.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/script-detect.test.ts
import { test, expect } from "bun:test";
import { isInline, runtimeForFile, buildScriptArgv } from "./script-detect.ts";

test("detects inline by metachar/newline", () => {
  expect(isInline("console.log(1)")).toBe(true);
  expect(isInline("my-script")).toBe(false);
  expect(isInline("a\nb")).toBe(true);
});

test("maps extension to runtime", () => {
  expect(runtimeForFile("x.py")).toBe("uv");
  expect(runtimeForFile("x.ts")).toBe("bun");
});

test("builds bun inline argv", () => {
  expect(buildScriptArgv({ inline: "code", runtime: "bun" }, "code"))
    .toEqual(["bun", "--no-env-file", "-e", "code"]);
});

test("builds uv inline argv with deps", () => {
  expect(buildScriptArgv({ inline: "c", runtime: "uv", deps: ["httpx"] }, "c"))
    .toEqual(["uv", "run", "--with", "httpx", "python", "-c", "c"]);
});

test("builds bun named argv", () => {
  expect(buildScriptArgv({ file: "s.ts", runtime: "bun" }, "/abs/s.ts"))
    .toEqual(["bun", "--no-env-file", "run", "/abs/s.ts"]);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/script-detect.ts — Inline-vs-named detection + runtime argv construction.
import type { ScriptSpec } from "../types.ts";

const META = /[\s;(){}&|<>$`"']/;

export function isInline(script: string): boolean {
  return script.includes("\n") || META.test(script);
}

export function runtimeForFile(path: string): "bun" | "uv" {
  return path.endsWith(".py") ? "uv" : "bun";
}

export function buildScriptArgv(spec: ScriptSpec, code: string): string[] {
  const runtime = spec.runtime ?? "bun";
  const inline = spec.inline !== undefined;
  if (runtime === "uv") {
    const withDeps = (spec.deps ?? []).flatMap((d) => ["--with", d]);
    return inline ? ["uv", "run", ...withDeps, "python", "-c", code] : ["uv", "run", ...withDeps, code];
  }
  return inline ? ["bun", "--no-env-file", "-e", code] : ["bun", "--no-env-file", "run", code];
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/script-detect.ts lib/script-detect.test.ts && git commit -m "feat: script runtime detection"`

---

## Section C — IO / Process (Layer 2)

> These touch the filesystem and subprocesses. Pure-ish units (state, artifacts, discovery, wt, git-info) are UNIT-tested with temp dirs or an injected fake `exec` (DIP). Real-process behavior (spawning `pi`, real `wt`) is INTEGRATION-tested in Section G. `runner.ts` exports `buildBaseArgs` for unit testing the flag assembly.

### Task C1: lib/pi-invocation.ts

**Files:** Create `lib/pi-invocation.ts`, Test `lib/pi-invocation.test.ts` (verified copy of subagent logic)

- [ ] **Step 1: Failing test**

```typescript
// lib/pi-invocation.test.ts
import { test, expect } from "bun:test";
import { getPiInvocation, writeSystemPrompt, cleanupTemp } from "./pi-invocation.ts";
import * as fs from "node:fs";

test("getPiInvocation returns a command + args including our args", () => {
  const { command, args } = getPiInvocation(["--mode", "json"]);
  expect(typeof command).toBe("string");
  expect(args).toContain("--mode");
});

test("writeSystemPrompt writes file then cleanup removes it", async () => {
  const { dir, filePath } = await writeSystemPrompt("node", "hello");
  expect(fs.readFileSync(filePath, "utf-8")).toBe("hello");
  cleanupTemp(dir, filePath);
  expect(fs.existsSync(filePath)).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/pi-invocation.ts — Resolve the pi binary and stage the system-prompt temp file.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  const isBunVirtual = script?.startsWith("/$bunfs/root/");
  if (script && !isBunVirtual && fs.existsSync(script)) {
    return { command: process.execPath, args: [script, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  if (/^pi(\.exe)?$/.test(execName)) return { command: process.execPath, args };
  return { command: "pi", args };
}

export async function writeSystemPrompt(name: string, prompt: string): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hugotown-"));
  const safe = name.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(dir, `system-${safe}.md`);
  await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir, filePath };
}

export function cleanupTemp(dir: string | null, filePath: string | null): void {
  if (filePath) try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  if (dir) try { fs.rmdirSync(dir); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/pi-invocation.ts lib/pi-invocation.test.ts && git commit -m "feat: pi binary resolution + system-prompt staging"`

### Task C2: lib/runner.ts

**Files:** Create `lib/runner.ts`, Test `lib/runner.test.ts` (unit: arg assembly; full spawn covered in Section G)

- [ ] **Step 1: Failing test**

```typescript
// lib/runner.test.ts
import { test, expect } from "bun:test";
import { buildBaseArgs } from "./runner.ts";

test("assembles fixed flags in order", () => {
  const a = buildBaseArgs({ provider: "anthropic", model: "claude-sonnet-4", thinking: "medium", system: "", task: "t", cwd: "/" });
  expect(a.slice(0, 9)).toEqual(["--mode", "json", "-p", "--no-session", "--provider", "anthropic", "--model", "claude-sonnet-4", "--thinking"]);
});

test("adds --tools allowlist when present", () => {
  const a = buildBaseArgs({ provider: "p", model: "m", thinking: "low", tools: ["read", "edit"], system: "", task: "t", cwd: "/" });
  expect(a).toContain("--tools");
  expect(a[a.indexOf("--tools") + 1]).toBe("read,edit");
});

test("omits --tools when empty", () => {
  const a = buildBaseArgs({ provider: "p", model: "m", thinking: "low", tools: [], system: "", task: "t", cwd: "/" });
  expect(a).not.toContain("--tools");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/runner.ts — Spawn one isolated `pi --mode json` subprocess; stream NDJSON to a result.
import { spawn } from "node:child_process";
import { getPiInvocation, writeSystemPrompt, cleanupTemp } from "./pi-invocation.ts";
import { applyJsonLine } from "./json-stream.ts";
import type { PiRunResult } from "../runtime-types.ts";

export interface RunPiOpts {
  provider: string; model: string; thinking: string;
  tools?: string[]; system: string; task: string; cwd: string; signal?: AbortSignal;
}

export function buildBaseArgs(o: RunPiOpts): string[] {
  const a = ["--mode", "json", "-p", "--no-session", "--provider", o.provider, "--model", o.model, "--thinking", o.thinking];
  if (o.tools && o.tools.length > 0) a.push("--tools", o.tools.join(","));
  return a;
}

function stream(command: string, args: string[], o: RunPiOpts, result: PiRunResult): Promise<{ exitCode: number; aborted: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd: o.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "", aborted = false;
    proc.stdout.on("data", (d) => {
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) applyJsonLine(result, line);
    });
    proc.stderr.on("data", (d) => { result.stderr += d.toString(); });
    proc.on("close", (code) => { if (buffer.trim()) applyJsonLine(result, buffer); resolve({ exitCode: code ?? 0, aborted }); });
    proc.on("error", () => resolve({ exitCode: 1, aborted }));
    if (o.signal) {
      const kill = () => { aborted = true; proc.kill("SIGTERM"); setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 5000); };
      o.signal.aborted ? kill() : o.signal.addEventListener("abort", kill, { once: true });
    }
  });
}

export async function runPi(o: RunPiOpts): Promise<PiRunResult> {
  const result: PiRunResult = { output: "", status: "ok", exitCode: 0, stderr: "", messages: [] };
  const sys = await writeSystemPrompt("node", o.system);
  try {
    const args = [...buildBaseArgs(o), "--append-system-prompt", sys.filePath, o.task];
    const { command, args: cmdArgs } = getPiInvocation(args);
    const { exitCode, aborted } = await stream(command, cmdArgs, o, result);
    result.exitCode = exitCode;
    result.status = exitCode === 0 && result.stopReason !== "error" && result.stopReason !== "aborted" && !aborted ? "ok" : "failed";
    return result;
  } finally {
    cleanupTemp(sys.dir, sys.filePath);
  }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/runner.ts lib/runner.test.ts && git commit -m "feat: pi subprocess runner"`

### Task C3: lib/state.ts

**Files:** Create `lib/state.ts`, Test `lib/state.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/state.test.ts
import { test, expect } from "bun:test";
import { saveRun, loadRun, listRuns } from "./state.ts";
import type { RunState } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-state-"));
const state: RunState = {
  id: "r1", workflow: "w", arguments: "", status: "running",
  artifacts_dir: "/tmp", base_branch: "main", started_at: "t", nodes: {},
};

test("save then load round-trips", () => {
  saveRun(home, state);
  expect(loadRun(home, "r1")?.workflow).toBe("w");
});

test("loadRun returns null for missing", () => {
  expect(loadRun(home, "nope")).toBeNull();
});

test("listRuns returns saved runs", () => {
  expect(listRuns(home).map((r) => r.id)).toContain("r1");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/state.ts — Persist/restore RunState as JSON files under <home>/runs/.
import * as fs from "node:fs";
import * as path from "node:path";
import type { RunState } from "../runtime-types.ts";

function runsDir(home: string): string { return path.join(home, "runs"); }

export function saveRun(home: string, state: RunState): void {
  fs.mkdirSync(runsDir(home), { recursive: true });
  fs.writeFileSync(path.join(runsDir(home), `${state.id}.json`), JSON.stringify(state, null, 2));
}

export function loadRun(home: string, id: string): RunState | null {
  try { return JSON.parse(fs.readFileSync(path.join(runsDir(home), `${id}.json`), "utf-8")); }
  catch { return null; }
}

export function listRuns(home: string): RunState[] {
  try {
    return fs.readdirSync(runsDir(home)).filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir(home), f), "utf-8")));
  } catch { return []; }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/state.ts lib/state.test.ts && git commit -m "feat: run state persistence"`

### Task C4: lib/artifacts.ts

**Files:** Create `lib/artifacts.ts`, Test `lib/artifacts.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/artifacts.test.ts
import { test, expect } from "bun:test";
import { createArtifactsDir } from "./artifacts.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

test("creates a per-run artifacts dir", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-art-"));
  const dir = createArtifactsDir(home, "run1");
  expect(fs.existsSync(dir)).toBe(true);
  expect(dir).toContain("run1");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/artifacts.ts — Create the per-run shared artifacts directory.
import * as fs from "node:fs";
import * as path from "node:path";

export function createArtifactsDir(home: string, id: string): string {
  const dir = path.join(home, "artifacts", id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/artifacts.ts lib/artifacts.test.ts && git commit -m "feat: artifacts dir creation"`

### Task C5: lib/wt.ts

**Files:** Create `lib/wt.ts`, Test `lib/wt.test.ts` (fake exec; real wt in Section G)

- [ ] **Step 1: Failing test**

```typescript
// lib/wt.test.ts
import { test, expect } from "bun:test";
import { wtCreate, wtPath, wtRemove } from "./wt.ts";
import type { ExecLike } from "../runtime-types.ts";

const fakeExec = (responses: Record<string, { stdout?: string; code?: number }>): ExecLike =>
  async (cmd, args) => {
    const key = `${cmd} ${args.join(" ")}`;
    const r = responses[key] ?? { code: 0 };
    return { stdout: r.stdout ?? "", stderr: "", code: r.code ?? 0, killed: false };
  };

test("wtCreate switches then resolves path", async () => {
  const exec = fakeExec({
    "wt switch --create hugotown/x": { code: 0 },
    "wt list --format=json": { stdout: JSON.stringify([{ branch: "hugotown/x", path: "/wt/x" }]) },
  });
  expect((await wtCreate(exec, "hugotown/x", "/repo")).path).toBe("/wt/x");
});

test("wtPath returns null when branch absent", async () => {
  const exec = fakeExec({ "wt list --format=json": { stdout: "[]" } });
  expect(await wtPath(exec, "missing", "/repo")).toBeNull();
});

test("wtRemove issues remove with flags", async () => {
  let called = "";
  const exec: ExecLike = async (cmd, args) => { called = `${cmd} ${args.join(" ")}`; return { stdout: "", stderr: "", code: 0, killed: false }; };
  await wtRemove(exec, "hugotown/x", "/repo");
  expect(called).toBe("wt remove hugotown/x --yes --force");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/wt.ts — Worktree lifecycle via the `wt` CLI (injected exec).
import type { ExecLike } from "../runtime-types.ts";

export async function wtPath(exec: ExecLike, branch: string, cwd: string): Promise<string | null> {
  const r = await exec("wt", ["list", "--format=json"], { cwd });
  if (r.code !== 0) return null;
  try {
    const list = JSON.parse(r.stdout) as Array<{ branch?: string; path?: string }>;
    return list.find((w) => w.branch === branch)?.path ?? null;
  } catch { return null; }
}

export async function wtCreate(exec: ExecLike, branch: string, cwd: string): Promise<{ path: string }> {
  const r = await exec("wt", ["switch", "--create", branch], { cwd });
  if (r.code !== 0) throw new Error(`wt switch failed: ${r.stderr}`);
  const p = await wtPath(exec, branch, cwd);
  if (!p) throw new Error(`worktree path not found for ${branch}`);
  return { path: p };
}

export async function wtMerge(exec: ExecLike, cwd: string): Promise<void> {
  const r = await exec("wt", ["merge", "--yes"], { cwd });
  if (r.code !== 0) throw new Error(`wt merge failed: ${r.stderr}`);
}

export async function wtRemove(exec: ExecLike, branch: string, cwd: string): Promise<void> {
  await exec("wt", ["remove", branch, "--yes", "--force"], { cwd });
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/wt.ts lib/wt.test.ts && git commit -m "feat: wt worktree integration"`

### Task C6: lib/git-info.ts

**Files:** Create `lib/git-info.ts`, Test `lib/git-info.test.ts` (fake exec)

- [ ] **Step 1: Failing test**

```typescript
// lib/git-info.test.ts
import { test, expect } from "bun:test";
import { detectBaseBranch } from "./git-info.ts";
import type { ExecLike } from "../runtime-types.ts";

test("reads origin/HEAD when available", async () => {
  const exec: ExecLike = async (_c, args) =>
    args.includes("symbolic-ref")
      ? { stdout: "refs/remotes/origin/main\n", stderr: "", code: 0, killed: false }
      : { stdout: "", stderr: "", code: 1, killed: false };
  expect(await detectBaseBranch(exec, "/repo")).toBe("main");
});

test("falls back to current branch then 'main'", async () => {
  const exec: ExecLike = async (_c, args) =>
    args.includes("--show-current")
      ? { stdout: "dev\n", stderr: "", code: 0, killed: false }
      : { stdout: "", stderr: "", code: 1, killed: false };
  expect(await detectBaseBranch(exec, "/repo")).toBe("dev");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/git-info.ts — Detect the repository base branch via git (injected exec).
import type { ExecLike } from "../runtime-types.ts";

export async function detectBaseBranch(exec: ExecLike, cwd: string): Promise<string> {
  const head = await exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
  if (head.code === 0) {
    const m = head.stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (m) return m[1];
  }
  const cur = await exec("git", ["branch", "--show-current"], { cwd });
  return cur.code === 0 && cur.stdout.trim() ? cur.stdout.trim() : "main";
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/git-info.ts lib/git-info.test.ts && git commit -m "feat: base branch detection"`

### Task C7: lib/discovery.ts

**Files:** Create `lib/discovery.ts`, Test `lib/discovery.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/discovery.test.ts
import { test, expect } from "bun:test";
import { findWorkflow, listWorkflows, findCommand } from "./discovery.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ht-proj-"));
const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-bundled-"));
fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
fs.mkdirSync(path.join(proj, "workflows"), { recursive: true });
fs.mkdirSync(path.join(bundled, "commands"), { recursive: true });
fs.writeFileSync(path.join(bundled, "workflows", "fix.yaml"), "name: fix\ndescription: bundled\nnodes:\n  - id: a\n    bash: x");
fs.writeFileSync(path.join(proj, "workflows", "fix.yaml"), "name: fix\ndescription: project\nnodes:\n  - id: a\n    bash: x");
fs.writeFileSync(path.join(bundled, "commands", "c.md"), "hi");

test("project workflow overrides bundled", () => {
  const p = findWorkflow("fix", [proj, bundled]);
  expect(p).toBe(path.join(proj, "workflows", "fix.yaml"));
});

test("listWorkflows dedupes by name (project wins)", () => {
  const list = listWorkflows([proj, bundled]);
  expect(list.find((w) => w.name === "fix")?.description).toBe("project");
});

test("findCommand resolves bundled when not in project", () => {
  expect(findCommand("c", [proj, bundled])).toBe(path.join(bundled, "commands", "c.md"));
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/discovery.ts — Resolve workflow/command files; earlier dirs override later ones.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseWorkflow } from "./loader.ts";

function firstExisting(dirs: string[], rel: string): string | null {
  for (const d of dirs) {
    const p = path.join(d, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function findWorkflow(name: string, dirs: string[]): string | null {
  return firstExisting(dirs, path.join("workflows", `${name}.yaml`));
}

export function findCommand(name: string, dirs: string[]): string | null {
  return firstExisting(dirs, path.join("commands", `${name}.md`));
}

export function listWorkflows(dirs: string[]): { name: string; description: string }[] {
  const seen = new Map<string, { name: string; description: string }>();
  for (const d of dirs) {
    const wd = path.join(d, "workflows");
    if (!fs.existsSync(wd)) continue;
    for (const f of fs.readdirSync(wd)) {
      const name = f.replace(/\.yaml$/, "");
      if (!f.endsWith(".yaml") || seen.has(name)) continue;
      try {
        const def = parseWorkflow(fs.readFileSync(path.join(wd, f), "utf-8"));
        seen.set(name, { name, description: def.description });
      } catch { /* skip invalid */ }
    }
  }
  return [...seen.values()];
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/discovery.ts lib/discovery.test.ts && git commit -m "feat: workflow/command discovery"`

### Task C8: lib/command-loader.ts

**Files:** Create `lib/command-loader.ts`, Test `lib/command-loader.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// lib/command-loader.test.ts
import { test, expect } from "bun:test";
import { loadCommandText } from "./command-loader.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-cmd-"));
fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
fs.writeFileSync(path.join(dir, "commands", "investigate.md"), "Investigate: $ARGUMENTS");

test("loads command text", () => {
  expect(loadCommandText("investigate", [dir])).toContain("Investigate:");
});

test("throws on missing command", () => {
  expect(() => loadCommandText("nope", [dir])).toThrow(/not found/);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// lib/command-loader.ts — Load a .md command template's raw text.
import * as fs from "node:fs";
import { findCommand } from "./discovery.ts";

export function loadCommandText(name: string, dirs: string[]): string {
  const file = findCommand(name, dirs);
  if (!file) throw new Error(`Command "${name}" not found in ${dirs.join(", ")}`);
  return fs.readFileSync(file, "utf-8");
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add lib/command-loader.ts lib/command-loader.test.ts && git commit -m "feat: command template loader"`

---

## Section D — Node Handlers (Layer 3)

> Each handler takes a `RunCtx` and returns a `NodeResult`. AI handlers (`prompt`, `command`, `loop`) accept an injectable `run = runPi` parameter (default = real spawn) so unit tests can pass a deterministic fake, while Section G drives the real spawn. Deterministic handlers (`bash`, `script`) expose pure helpers (`inlineOutputs`, `resolveArgv`) for unit tests; real-process behavior is integration-tested in Section G.

### Task D1: nodes/prompt.ts

**Files:** Create `nodes/prompt.ts`, Test `nodes/prompt.test.ts`
**Exports (contract update):** `runAiTask(rctx, task, run?)`, `runPrompt(rctx, run?)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/prompt.test.ts
import { test, expect } from "bun:test";
import { runPrompt, runAiTask } from "./prompt.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";

const okRun = async (): Promise<PiRunResult> =>
  ({ output: '{"type":"bug"}', status: "ok", exitCode: 0, stderr: "", messages: [] });

const ctx = (overrides = {}): RunCtx => ({
  node: { id: "n", prompt: "Classify $ARGUMENTS", ...overrides },
  state: {} as RunCtx["state"],
  deps: { defaultProvider: "anthropic", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
  sub: { builtins: { ARGUMENTS: "#42" }, nodeOutputs: {}, nodeStructured: {} },
  cwd: "/p",
});

test("runs AI task and returns completed output", async () => {
  const r = await runPrompt(ctx(), okRun);
  expect(r.status).toBe("completed");
});

test("validates output_format and exposes structured data", async () => {
  const r = await runAiTask(ctx({ output_format: { type: "object", required: ["type"] } }), "x", okRun);
  expect(r.status).toBe("completed");
  expect((r.structured as { type: string }).type).toBe("bug");
});

test("fails when output_format unmet", async () => {
  const bad = async (): Promise<PiRunResult> => ({ output: "{}", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runAiTask(ctx({ output_format: { type: "object", required: ["type"] } }), "x", bad);
  expect(r.status).toBe("failed");
});

test("fails when no model resolved", async () => {
  const c = ctx(); c.deps = { ...c.deps, defaultModel: undefined };
  const r = await runAiTask(c, "x", okRun);
  expect(r.status).toBe("failed");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/prompt.ts — Run a prompt/command AI task in an isolated pi subprocess.
import { runPi } from "../lib/runner.ts";
import { substitute } from "../lib/variable-sub.ts";
import { enforceOutput } from "../lib/output-schema.ts";
import { QUESTION_PROHIBITION, DEFAULT_BLOCKED_TOOLS } from "../constants.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export async function runAiTask(rctx: RunCtx, task: string, run = runPi): Promise<NodeResult> {
  const { node, deps, cwd } = rctx;
  const provider = node.provider ?? deps.defaultProvider;
  const model = node.model ?? deps.defaultModel;
  if (!provider || !model) return { status: "failed", output: "", error: "No provider/model resolved for node" };
  const tools = node.allowed_tools?.filter((t) => !DEFAULT_BLOCKED_TOOLS.includes(t));
  const r = await run({
    provider, model, thinking: node.thinking ?? "medium",
    tools, system: QUESTION_PROHIBITION, task, cwd, signal: deps.signal,
  });
  if (r.status === "failed") return { status: "failed", output: r.output, error: r.errorMessage ?? r.stderr };
  if (node.output_format) {
    const v = enforceOutput(r.output, node.output_format);
    if (!v.ok) return { status: "failed", output: r.output, error: v.error };
    return { status: "completed", output: r.output, structured: v.data };
  }
  return { status: "completed", output: r.output };
}

export function runPrompt(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  return runAiTask(rctx, substitute(rctx.node.prompt ?? "", rctx.sub), run);
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/prompt.ts nodes/prompt.test.ts && git commit -m "feat: prompt node handler"`

### Task D2: nodes/command.ts

**Files:** Create `nodes/command.ts`, Test `nodes/command.test.ts`
**Exports (contract):** `runCommand(rctx, run?)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/command.test.ts
import { test, expect } from "bun:test";
import { runCommand } from "./command.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-cmd-h-"));
fs.mkdirSync(path.join(bundled, "commands"), { recursive: true });
fs.writeFileSync(path.join(bundled, "commands", "investigate.md"), "Investigate: $ARGUMENTS");

const capture = { task: "" };
const fakeRun = async (o: { task: string }): Promise<PiRunResult> => {
  capture.task = o.task;
  return { output: "done", status: "ok", exitCode: 0, stderr: "", messages: [] };
};

test("loads template, substitutes, runs", async () => {
  const ctx: RunCtx = {
    node: { id: "n", command: "investigate" },
    state: {} as RunCtx["state"],
    deps: { defaultProvider: "p", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: bundled, projectDir: "/nope" },
    sub: { builtins: { ARGUMENTS: "#7" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = await runCommand(ctx, fakeRun as never);
  expect(r.status).toBe("completed");
  expect(capture.task).toBe("Investigate: #7");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/command.ts — Run a command node: load .md template, substitute, run as AI task.
import * as path from "node:path";
import { runAiTask } from "./prompt.ts";
import { loadCommandText } from "../lib/command-loader.ts";
import { substitute } from "../lib/variable-sub.ts";
import { runPi } from "../lib/runner.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export function runCommand(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  const { node, deps } = rctx;
  const dirs = [path.join(deps.projectDir, ".hugotown"), deps.bundledDir];
  const text = loadCommandText(node.command ?? "", dirs);
  return runAiTask(rctx, substitute(text, rctx.sub), run);
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/command.ts nodes/command.test.ts && git commit -m "feat: command node handler"`

### Task D3: nodes/bash.ts

**Files:** Create `nodes/bash.ts`, Test `nodes/bash.test.ts`
**Exports (contract):** `inlineOutputs(template, sub)`, `runBash(rctx)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/bash.test.ts
import { test, expect } from "bun:test";
import { inlineOutputs, runBash } from "./bash.ts";
import type { RunCtx, SubContext } from "../runtime-types.ts";

const sub: SubContext = {
  builtins: { ARGUMENTS: "hello" },
  nodeOutputs: { prev: "a'b" },
  nodeStructured: {},
};

test("inlineOutputs shell-quotes node outputs", () => {
  expect(inlineOutputs("echo $prev.output", sub)).toBe("echo 'a'\\''b'");
});

test("runBash executes with builtins as env", async () => {
  const ctx: RunCtx = {
    node: { id: "n", bash: "echo $ARGUMENTS" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  const r = await runBash(ctx);
  expect(r.status).toBe("completed");
  expect(r.output).toBe("hello");
});

test("runBash fails on non-zero exit", async () => {
  const ctx: RunCtx = {
    node: { id: "n", bash: "exit 3" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  expect((await runBash(ctx)).status).toBe("failed");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/bash.ts — Run a deterministic bash node. Builtins via env; node outputs inline-quoted.
import { spawn } from "node:child_process";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";

const shQuote = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;

export function inlineOutputs(template: string, sub: SubContext): string {
  const withFields = template.replace(/\$([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)/g, (m, id, f) => {
    const s = sub.nodeStructured[id] as Record<string, unknown> | undefined;
    return s && f in s ? shQuote(String(s[f])) : m;
  });
  return withFields.replace(/\$([A-Za-z0-9_-]+)\.output\b/g, (m, id) =>
    id in sub.nodeOutputs ? shQuote(sub.nodeOutputs[id]) : m);
}

export function runBash(rctx: RunCtx): Promise<NodeResult> {
  const { node, sub, cwd, deps } = rctx;
  const script = inlineOutputs(node.bash ?? "", sub);
  const env = { ...process.env, ...sub.builtins };
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", script], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("close", (code) => resolve(code === 0
      ? { status: "completed", output: out.replace(/\n$/, "") }
      : { status: "failed", output: out, error: err || `exit ${code}` }));
    proc.on("error", (e) => resolve({ status: "failed", output: "", error: e.message }));
    if (deps.signal) deps.signal.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/bash.ts nodes/bash.test.ts && git commit -m "feat: bash node handler"`

### Task D4: nodes/script.ts

**Files:** Create `nodes/script.ts`, Test `nodes/script.test.ts`
**Exports (contract):** `resolveArgv(spec, sub, projectDir)`, `runScript(rctx)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/script.test.ts
import { test, expect } from "bun:test";
import { resolveArgv, runScript } from "./script.ts";
import type { RunCtx, SubContext } from "../runtime-types.ts";

const sub: SubContext = { builtins: {}, nodeOutputs: { prev: "VALUE" }, nodeStructured: {} };

test("resolveArgv inlines RAW (unquoted) substitution for inline bun", () => {
  const argv = resolveArgv({ inline: "console.log('$prev.output')", runtime: "bun" }, sub, "/p");
  expect(argv).toEqual(["bun", "--no-env-file", "-e", "console.log('VALUE')"]);
});

test("resolveArgv builds named uv path under .hugotown/scripts", () => {
  const argv = resolveArgv({ file: "calc.py" }, sub, "/p");
  expect(argv[0]).toBe("uv");
  expect(argv[argv.length - 1]).toContain("/.hugotown/scripts/calc.py");
});

test("runScript runs inline bun and captures stdout", async () => {
  const ctx: RunCtx = {
    node: { id: "n", script: { inline: "console.log(40 + 2)", runtime: "bun" } },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  expect((await runScript(ctx)).output).toBe("42");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/script.ts — Run a deterministic bun/uv script node (inline or named).
import { spawn } from "node:child_process";
import * as path from "node:path";
import { buildScriptArgv, runtimeForFile } from "../lib/script-detect.ts";
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";
import type { ScriptSpec } from "../types.ts";

export function resolveArgv(spec: ScriptSpec, sub: SubContext, projectDir: string): string[] {
  if (spec.inline !== undefined) return buildScriptArgv(spec, substitute(spec.inline, sub));
  const file = path.join(projectDir, ".hugotown", "scripts", spec.file ?? "");
  return buildScriptArgv({ ...spec, runtime: spec.runtime ?? runtimeForFile(file) }, file);
}

export function runScript(rctx: RunCtx): Promise<NodeResult> {
  const { node, sub, cwd, deps } = rctx;
  const argv = resolveArgv(node.script as ScriptSpec, sub, deps.projectDir);
  const env = { ...process.env, ...sub.builtins };
  return new Promise((resolve) => {
    const proc = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("close", (code) => resolve(code === 0
      ? { status: "completed", output: out.replace(/\n$/, "") }
      : { status: "failed", output: out, error: err || `exit ${code}` }));
    proc.on("error", (e) => resolve({ status: "failed", output: "", error: e.message }));
    if (deps.signal) deps.signal.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/script.ts nodes/script.test.ts && git commit -m "feat: script node handler"`

---

### Task D5: nodes/loop.ts

**Files:** Create `nodes/loop.ts`, Test `nodes/loop.test.ts`
**Exports (contract):** `runLoop(rctx, run?)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/loop.test.ts
import { test, expect } from "bun:test";
import { runLoop } from "./loop.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";

const ctx = (loop: object): RunCtx => ({
  node: { id: "n", loop } as RunCtx["node"],
  state: {} as RunCtx["state"],
  deps: { defaultProvider: "p", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
  sub: { builtins: {}, nodeOutputs: {}, nodeStructured: {} },
  cwd: "/p",
});

test("loops until signal then completes (strips tags)", async () => {
  let i = 0;
  const run = async (): Promise<PiRunResult> => {
    i++;
    const out = i < 3 ? "working" : "result\n<promise>COMPLETE</promise>";
    return { output: out, status: "ok", exitCode: 0, stderr: "", messages: [] };
  };
  const r = await runLoop(ctx({ prompt: "go", until: "COMPLETE", max_iterations: 5 }), run);
  expect(r.status).toBe("completed");
  expect(r.output).toBe("result");
  expect(i).toBe(3);
});

test("fails when max_iterations exceeded", async () => {
  const run = async (): Promise<PiRunResult> => ({ output: "still going", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runLoop(ctx({ prompt: "go", until: "DONE", max_iterations: 2 }), run);
  expect(r.status).toBe("failed");
  expect(r.error).toMatch(/exceeded 2/);
});

test("passes $LOOP_PREV_OUTPUT into the next iteration", async () => {
  const seen: string[] = [];
  let i = 0;
  const run = async (o: { task: string }): Promise<PiRunResult> => {
    seen.push(o.task); i++;
    return { output: i < 2 ? "one" : "<promise>DONE</promise>", status: "ok", exitCode: 0, stderr: "", messages: [] };
  };
  await runLoop(ctx({ prompt: "prev=$LOOP_PREV_OUTPUT", until: "DONE", max_iterations: 3 }), run as never);
  expect(seen[0]).toBe("prev=");
  expect(seen[1]).toBe("prev=one");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/loop.ts — Run an AI loop until a completion signal, until_bash, or max iterations.
import { runPi } from "../lib/runner.ts";
import { substitute } from "../lib/variable-sub.ts";
import { detectSignal, stripSignalTags } from "../lib/completion.ts";
import { QUESTION_PROHIBITION } from "../constants.ts";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";
import type { LoopSpec } from "../types.ts";

async function untilBashPasses(script: string, sub: SubContext, rctx: RunCtx): Promise<boolean> {
  const r = await rctx.deps.exec("bash", ["-c", substitute(script, sub)], { cwd: rctx.cwd, signal: rctx.deps.signal });
  return r.code === 0;
}

export async function runLoop(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  const { node, deps, sub, cwd } = rctx;
  const spec = node.loop as LoopSpec;
  const provider = node.provider ?? deps.defaultProvider;
  const model = node.model ?? deps.defaultModel;
  if (!provider || !model) return { status: "failed", output: "", error: "No provider/model resolved" };
  let prev = "";
  for (let i = 0; i < spec.max_iterations; i++) {
    const iterSub: SubContext = { ...sub, builtins: { ...sub.builtins, LOOP_PREV_OUTPUT: prev } };
    const r = await run({
      provider, model, thinking: node.thinking ?? "medium", tools: node.allowed_tools,
      system: QUESTION_PROHIBITION, task: substitute(spec.prompt, iterSub), cwd, signal: deps.signal,
    });
    if (r.status === "failed") return { status: "failed", output: r.output, error: r.errorMessage ?? r.stderr };
    prev = stripSignalTags(r.output);
    if (detectSignal(r.output, spec.until)) return { status: "completed", output: prev };
    if (spec.until_bash && (await untilBashPasses(spec.until_bash, iterSub, rctx))) {
      return { status: "completed", output: prev };
    }
  }
  return { status: "failed", output: prev, error: `Loop exceeded ${spec.max_iterations} iterations` };
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/loop.ts nodes/loop.test.ts && git commit -m "feat: loop node handler"`

### Task D6: nodes/approval.ts

**Files:** Create `nodes/approval.ts`, Test `nodes/approval.test.ts`
**Exports (contract):** `runApproval(rctx)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/approval.test.ts
import { test, expect } from "bun:test";
import { runApproval } from "./approval.ts";
import type { RunCtx } from "../runtime-types.ts";

test("returns paused with substituted message + notifies", () => {
  const msgs: string[] = [];
  const ctx: RunCtx = {
    node: { id: "gate", approval: { message: "Review $ARGUMENTS" } },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: (m) => msgs.push(m), emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: { ARGUMENTS: "#42" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = runApproval(ctx);
  expect(r.status).toBe("paused");
  expect(r.output).toBe("Review #42");
  expect(msgs[0]).toContain("Review #42");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/approval.ts — Signal a non-blocking pause at a human approval gate.
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";
import type { ApprovalSpec } from "../types.ts";

export function runApproval(rctx: RunCtx): NodeResult {
  const spec = rctx.node.approval as ApprovalSpec;
  const message = substitute(spec.message, rctx.sub);
  rctx.deps.notify(`Approval required: ${message}`, "info");
  return { status: "paused", output: message };
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/approval.ts nodes/approval.test.ts && git commit -m "feat: approval node handler"`

### Task D7: nodes/cancel.ts

**Files:** Create `nodes/cancel.ts`, Test `nodes/cancel.test.ts`
**Exports (contract):** `runCancel(rctx)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/cancel.test.ts
import { test, expect } from "bun:test";
import { runCancel } from "./cancel.ts";
import type { RunCtx } from "../runtime-types.ts";

test("returns cancelled with substituted reason", () => {
  const ctx: RunCtx = {
    node: { id: "c", cancel: "Refusing on $BASE_BRANCH" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: { BASE_BRANCH: "main" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = runCancel(ctx);
  expect(r.status).toBe("cancelled");
  expect(r.output).toBe("Refusing on main");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/cancel.ts — Cancel the run with a (substituted) reason.
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export function runCancel(rctx: RunCtx): NodeResult {
  return { status: "cancelled", output: substitute(rctx.node.cancel ?? "", rctx.sub) };
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/cancel.ts nodes/cancel.test.ts && git commit -m "feat: cancel node handler"`

### Task D8: nodes/dispatch.ts

**Files:** Create `nodes/dispatch.ts`, Test `nodes/dispatch.test.ts`
**Exports (contract):** `nodeType(node)`, `dispatchNode(rctx)`

- [ ] **Step 1: Failing test**

```typescript
// nodes/dispatch.test.ts
import { test, expect } from "bun:test";
import { nodeType, dispatchNode } from "./dispatch.ts";
import type { RunCtx } from "../runtime-types.ts";

test("identifies node type", () => {
  expect(nodeType({ id: "a", bash: "x" })).toBe("bash");
  expect(nodeType({ id: "a", cancel: "r" })).toBe("cancel");
});

test("throws on typeless node", () => {
  expect(() => nodeType({ id: "a" })).toThrow(/no type/);
});

test("routes cancel node to runCancel", async () => {
  const ctx: RunCtx = {
    node: { id: "c", cancel: "stop" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: {}, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  expect((await dispatchNode(ctx)).status).toBe("cancelled");
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```typescript
// nodes/dispatch.ts — Route a node to its type handler.
import type { RunCtx, NodeResult } from "../runtime-types.ts";
import type { NodeType, NodeDef } from "../types.ts";
import { runPrompt } from "./prompt.ts";
import { runCommand } from "./command.ts";
import { runBash } from "./bash.ts";
import { runScript } from "./script.ts";
import { runLoop } from "./loop.ts";
import { runApproval } from "./approval.ts";
import { runCancel } from "./cancel.ts";

const ORDER: NodeType[] = ["prompt", "command", "bash", "script", "loop", "approval", "cancel"];

export function nodeType(node: NodeDef): NodeType {
  for (const k of ORDER) if ((node as Record<string, unknown>)[k] !== undefined) return k;
  throw new Error(`Node "${node.id}" has no type field`);
}

export function dispatchNode(rctx: RunCtx): Promise<NodeResult> | NodeResult {
  switch (nodeType(rctx.node)) {
    case "prompt": return runPrompt(rctx);
    case "command": return runCommand(rctx);
    case "bash": return runBash(rctx);
    case "script": return runScript(rctx);
    case "loop": return runLoop(rctx);
    case "approval": return runApproval(rctx);
    case "cancel": return runCancel(rctx);
  }
}
```

- [ ] **Step 4: Run → PASS**.
- [ ] **Step 5: Commit** — `git add nodes/dispatch.ts nodes/dispatch.test.ts && git commit -m "feat: node dispatch router"`

---
