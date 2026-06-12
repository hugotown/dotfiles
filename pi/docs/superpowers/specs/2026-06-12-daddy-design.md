# daddy — Design Specification

**Date:** 2026-06-12
**Status:** Approved
**Type:** New pi extension (independent, zero external deps)

## Summary

A native pi extension that brings Archon-style YAML DAG workflow orchestration into the pi ecosystem. Executes multi-step AI coding tasks as directed acyclic graphs with 7 node types, git worktree isolation via `wt`, GitHub lifecycle integration via `gh` CLI, structured output validation, approval gates, and resume-on-failure.

## Decisions

| Decision | Choice |
|----------|--------|
| Relationship to existing extensions | Independent — coexists with daddy/obra-sp-flow/subagent |
| Execution backend | Hybrid: subagent-style pi subprocesses for AI nodes + own executor for deterministic nodes |
| External dependencies | Zero. Own runner implementation (no pi-subagents npm import) |
| Isolation strategy | `wt` CLI (worktrunk) for git worktree management |
| Trigger mechanism | `/daddy flow=<name> <args>` explicit command |
| Workflow storage | Bundled in extension + `.daddy/workflows/` project override |
| Node types | All 7: command, prompt, bash, script, loop, approval, cancel |
| Platform adapters | Pi TUI only + GitHub lifecycle via `gh` CLI |
| Persistence | Hybrid: state files (`.daddy/runs/`) + session events for TUI |
| Model configuration | Uses pi's settings.json models directly, per-node override |
| Approval UX | Inline in chat (text-based) |
| Structured output | JSON Schema validation on node outputs |
| Bundled workflows | 3 examples: fix-issue, feature-dev, pr-review |
| Commands system | `.daddy/commands/` project + extension bundled, .md templates |

## Architecture

### Extension Structure

```
extensions/daddy/
  index.ts                    Entry point: registerCommand + registerTool + hooks
  package.json                Manifest: "pi": { "extensions": ["./index.ts"] }
  tsconfig.json               Strict ESNext + bundler resolution
  config.yml                  Default config (timeouts, concurrency)
  constants.ts                Prompt snippets, completion signals, blocked tools
  types.ts                    Core interfaces
  schema.ts                   TypeBox schemas for tool parameters
  commands/                   Bundled command templates (.md)
    investigate-issue.md
    implement-feature.md
    review-code.md
  workflows/                  Bundled default workflows (.yaml)
    fix-issue.yaml
    feature-dev.yaml
    pr-review.yaml
  lib/                        Pure logic (zero SDK imports)
    loader.ts                 YAML parsing + validation
    validator.ts              DAG validation (cycles, deps, types)
    dag-executor.ts           Topological sort + layer execution
    variable-sub.ts           $variable substitution engine
    condition-eval.ts         when: expression evaluator
    output-schema.ts          JSON Schema validation for structured output
    state.ts                  Run state management (memory + file)
    runner.ts                 pi subprocess spawner (--mode json -p --no-session)
    json-stream.ts            Parse pi JSON streaming events
    wt.ts                     wt CLI integration (switch, remove, merge)
    github.ts                 gh CLI operations (deterministic)
    command-loader.ts         Load .md templates + variable substitution
    discovery.ts              Workflow discovery (bundled + project)
    semaphore.ts              Concurrency limiter for parallel nodes
    summary.ts                Build model-visible result text
  nodes/                      Node type handlers (one per type)
    prompt.ts                 prompt: node execution
    command.ts                command: node (loads .md template)
    bash.ts                   bash: node (shell execution)
    script.ts                 script: node (bun/uv runtime)
    loop.ts                   loop: node (iterate until signal)
    approval.ts               approval: node (pause + wait)
    cancel.ts                 cancel: node (abort workflow)
  ui/                         Inline render components
    render-call.ts            Tool call view (workflow starting)
    render-result.ts          Tool result view (per-node outcomes)
    shared.ts                 Status icons, formatters
  panel/                      TUI overlay panel (monitoring)
    view.ts                   Main panel component
    list-render.ts            Left: node list with status
    detail-render.ts          Right: streaming output
  tests/                      Unit tests (bun test)
    loader.test.ts
    validator.test.ts
    dag-executor.test.ts
    variable-sub.test.ts
    condition-eval.test.ts
```

### Project-Level Structure

```
<project>/
  .daddy/
    workflows/              Project-specific workflows (override bundled)
    commands/               Project-specific command templates
    runs/                   Persisted run state files
```

## Workflow YAML Schema

### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Unique workflow identifier |
| `description` | string | yes | -- | Description for listings |
| `worktree` | boolean | no | false | Create worktree via `wt switch --create` |
| `model` | string | no | pi session model | Default model for AI nodes |
| `concurrency` | number | no | 4 | Max parallel nodes |
| `persist_sessions` | boolean | no | false | Save session IDs across re-runs |

### Node Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique node identifier |
| `depends_on` | string[] | Prerequisite node IDs |
| `when` | string | Condition expression for execution |
| `trigger_rule` | enum | `all_success` / `one_success` / `all_done` |
| `model` | string | Model override for this node |
| `context` | `fresh` / `shared` | AI context strategy. `fresh` = no prior context. `shared` = inject dependency outputs as context prefix. Default: `fresh` |
| `output_format` | object | JSON Schema for structured output |
| `allowed_tools` | string[] | Tool allowlist for subprocess |
| `denied_tools` | string[] | Tool denylist |
| `retry` | object | `{ max: N, delay_ms: N }` |
| `always_run` | boolean | Execute regardless of upstream failures |

### Node Types (exactly one per node)

| Field | Description |
|-------|-------------|
| `prompt:` | Inline prompt string sent to pi subprocess |
| `command:` | Name of .md file in commands/ |
| `bash:` | Shell script (deterministic, no AI) |
| `script:` | `{ inline: "code" }` or `{ file: "path" }` with `runtime: bun/uv` (default: bun) |
| `loop:` | `{ prompt, until, max_iterations, fresh_context, until_bash }` |
| `approval:` | `{ message, capture_response, on_reject }` |
| `cancel:` | Reason string |

### Variables

| Variable | Resolves to |
|----------|-------------|
| `$ARGUMENTS` | User input when triggering workflow |
| `$ARTIFACTS_DIR` | Shared directory for the run |
| `$BASE_BRANCH` | Base branch (auto-detected via git) |
| `$WORKFLOW_ID` | UUID of current run |
| `$RUN_DIR` | Path to run state directory |
| `$nodeId.output` | Raw output text from completed node |
| `$nodeId.output.field` | Specific field from structured output |
| `$LOOP_PREV_OUTPUT` | Previous iteration output (loop) |
| `$LOOP_USER_INPUT` | User input in approval within loop |
| `$REJECTION_REASON` | Reason from reject (when on_reject: retry) |

## DAG Execution Engine

### Flow

```
/daddy flow=<name> <args>
  1. DISCOVERY   → find YAML (project > bundled)
  2. LOAD        → parse YAML + validate DAG
  3. WORKTREE    → wt switch --create (if enabled)
  4. STATE INIT  → create .daddy/runs/<id>.json
  5. TOPO SORT   → arrange nodes into layers
  6. EXECUTE     → for each layer:
                   a. Filter by when: conditions
                   b. Apply trigger_rule join logic
                   c. Execute eligible nodes in parallel (semaphore-bounded)
                   d. Capture outputs + persist state
                   e. Handle failures (retry/skip/abort)
  7. COMPLETE    → summarize + prompt for wt merge/remove
```

### Node Execution

| Type | How it executes |
|------|-----------------|
| `prompt` | Spawn `pi --mode json -p --no-session --model X` with substituted prompt |
| `command` | Load .md template, substitute vars, spawn pi subprocess |
| `bash` | `Bun.spawn(["bash", "-c", script])`, capture stdout |
| `script` | `Bun.spawn(["bun", "run", file])` or `Bun.spawn(["uv", "run", file])` |
| `loop` | Spawn pi in loop. Check completion signal after each iteration |
| `approval` | Emit inline message. Pause run. Wait for user response via input hook |
| `cancel` | Set run status to cancelled. Skip remaining nodes |

### Failure Handling

1. Node fails → retry up to `retry.max` times with `retry.delay_ms`
2. Retries exhausted → mark `failed_final`
3. Downstream with `trigger_rule: all_success` → SKIPPED
4. `always_run: true` → executes regardless
5. `trigger_rule: all_done` → executes when all deps finished

### Resume

1. Load `.daddy/runs/<id>.json`
2. Skip nodes with `status: completed` (reload their output)
3. Re-execute failed node from scratch
4. Continue DAG normally

## wt Integration

### Worktree Lifecycle

```
START    → wt switch --create daddy/<workflow>-<short-id>
EXECUTE  → all nodes run in worktree CWD
COMPLETE → prompt user:
           /daddy merge   → wt merge --yes
           /daddy remove  → wt remove --yes --force
           /daddy keep    → leave for manual review
```

Branch naming: `daddy/<workflow-name>-<6-char-hash>`

Invoked via `pi.exec("wt", [...args])` — no git worktree reimplementation.

## GitHub Lifecycle

All GitHub operations are `bash:` nodes using `gh` CLI:

```yaml
- id: create-pr
  bash: |
    gh pr create --title "$PR_TITLE" --body-file $ARTIFACTS_DIR/pr-body.md --base $BASE_BRANCH
- id: add-labels
  bash: "gh issue edit $ISSUE_NUMBER --add-label 'in-progress'"
- id: close-issue
  bash: "gh issue close $ISSUE_NUMBER --comment 'Fixed in #$PR_NUMBER'"
```

No special "github" node type — keeps the engine simple.

## pi ExtensionAPI Integration

### Registration

```typescript
export default function daddy(pi: ExtensionAPI): void {
  pi.registerCommand("daddy", { ... });
  pi.registerTool({ name: "daddy", ... });
  pi.on("session_start", ...);   // Restore paused runs
  pi.on("input", ...);           // Intercept approve/reject/subcommands
  pi.on("session_shutdown", ...); // Persist in-flight state
}
```

### Subcommands

| Command | Action |
|---------|--------|
| `/daddy flow=<name> <args>` | Execute workflow |
| `/daddy list` | List available workflows |
| `/daddy status` | Active/paused runs |
| `/daddy resume <id>` | Resume failed run |
| `/daddy approve [comment]` | Approve pending gate |
| `/daddy reject [reason]` | Reject pending gate |
| `/daddy merge` | Merge current worktree |
| `/daddy remove` | Remove worktree |
| `/daddy keep` | Keep worktree |
| `/daddy validate <name>` | Validate workflow YAML |

## Runner (pi subprocess spawning)

### Spawn Configuration

```
pi --mode json -p --no-session --no-skills --model <model>
   --tools <allowed> --deny-tools <denied> --prompt-file <temp>
```

Always blocked: `ask_user_question` (subprocesses cannot ask the user).

### Structured Output

1. Try parse raw output as JSON → validate against schema
2. Try extract JSON from markdown code blocks → validate
3. Fail → mark node failed (retry with schema hint in prompt)

## Variable Substitution

### Resolution Order

1. `$nodeId.output.field` — structured field access
2. `$nodeId.output` — raw node output
3. `$BUILTIN_VAR` — built-in variables

### Condition Evaluation

Safe expression evaluator (no eval, recursive descent parser).

Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`
Types: string literals, numbers, booleans

### trigger_rule Semantics

| Rule | True when... |
|------|-------------|
| `all_success` | ALL deps completed successfully |
| `one_success` | AT LEAST ONE dep succeeded |
| `all_done` | ALL deps finished (success or failure) |

## Loop Nodes

```yaml
loop:
  prompt: "Fix remaining failures. Previous: $LOOP_PREV_OUTPUT"
  until: ALL_TASKS_COMPLETE
  max_iterations: 5
  fresh_context: true
  until_bash: "bun tsc --noEmit 2>&1 | grep -c 'error' | grep '^0$'"
```

Completion signals: `ALL_TASKS_COMPLETE`, `APPROVED`, `DONE`, `COMPLETE`

## Approval Gates

```yaml
approval:
  message: "Review the diff before PR creation."
  capture_response: true
  on_reject: retry | abort
```

Flow: emit inline message → pause → wait for `/daddy approve` or `reject` → resume.

## State Persistence

### Run State File (`.daddy/runs/<id>.json`)

```json
{
  "id": "uuid",
  "workflow": "fix-issue",
  "arguments": "Fix login timeout #42",
  "status": "running|completed|failed|cancelled|paused",
  "worktree": { "branch": "daddy/fix-issue-abc123", "path": "/path" },
  "started_at": "ISO",
  "completed_at": "ISO",
  "nodes": {
    "classify": {
      "status": "completed|running|pending|failed|skipped",
      "output": "...",
      "started_at": "ISO",
      "completed_at": "ISO",
      "session_id": "optional"
    }
  }
}
```

### Session Events (TUI)

Every state transition emits via `pi.appendEntry()` for real-time visibility.

## Observability

Inline progress messages:
```
[fix-issue] Layer 1/5: classify → running...
[fix-issue] classify: completed (2.3s)
[fix-issue] Layer 2/5: investigate → running...
[fix-issue] review-gate → waiting for approval
```

## Error Handling

| Error | Handling |
|-------|----------|
| YAML parse error | Fail fast, show line/column |
| DAG validation | Fail fast, show constraint violation |
| Node timeout | Kill subprocess, mark failed, retry |
| Subprocess crash | Mark failed, capture stderr, retry |
| Schema validation | Output mismatch, retry with hint |
| wt failure | Log, fallback to CWD (skip worktree) |
| Approval timeout | Stay paused indefinitely |
| Retries exhausted | Mark failed_final, skip downstream |

## Bundled Workflows

### fix-issue.yaml
```
classify → investigate → implement → test → review-gate → create-pr | abort
```

### feature-dev.yaml
```
plan → implement → test-loop → review-gate → create-pr
```

### pr-review.yaml
```
fetch-diff → analyze (3 parallel) → synthesize → comment-pr
```

## Design Principles

- SOLID + DRY throughout
- 70-line target per file, 120-line hard cap
- Zero cross-extension dependencies
- Zero npm dependencies beyond pi SDK + TypeBox + yaml parser
- Code owns control flow; LLM only where creativity is needed
- Deterministic operations (bash, script, cancel) run at 0 AI tokens
- Event-sourced state for crash recovery
- `wt` for isolation (never reimplement git worktree logic)
- `gh` for GitHub (never reimplement GitHub API calls)

## Out of Scope

- Web UI / HTTP API (pi TUI only)
- Database persistence (files only)
- Platform adapters (Slack, Telegram, Discord)
- MCP server integration (may be added later)
- Skills preloading per node (may be added later)
- Hooks (Claude SDK PreToolUse/PostToolUse — may be added later)
- Model tiers/aliases abstraction (uses pi settings.json directly)
- Telemetry
