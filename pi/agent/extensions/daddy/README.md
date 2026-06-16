# daddy

Run a `/daddy`
command (and a `daddy` tool) load a workflow file, validate the dependency graph, and
execute its nodes layer by layer — AI steps run as isolated `pi` subprocesses, deterministic
steps run in-process. Supports parallelism, approval gates with pause/resume, structured
output, retries, conditional branching, loops, and optional `wt` worktree isolation.

---

## Table of contents

- [What it is](#what-it-is)
- [Install & load](#install--load)
- [Quick start](#quick-start)
- [The `/daddy` command](#the-daddy-command)
- [The `daddy` tool (for agents)](#the-daddy-tool-for-agents)
- [Workflow file format](#workflow-file-format)
  - [Top-level fields](#top-level-fields)
  - [Node types](#node-types)
  - [Common node fields](#common-node-fields)
- [Variable substitution](#variable-substitution)
- [Conditions (`when:`)](#conditions-when)
- [Trigger rules (join semantics)](#trigger-rules-join-semantics)
- [Structured output](#structured-output)
- [Loops](#loops)
- [Approval gates: pause & resume](#approval-gates-pause--resume)
- [Retries](#retries)
- [Worktrees](#worktrees)
- [Per-node models](#per-node-models)
- [Discovery & overriding](#discovery--overriding)
- [State, runs & artifacts](#state-runs--artifacts)
- [Live feedback](#live-feedback)
- [Configuration (`config.yml`)](#configuration-configyml)
- [Bundled workflows](#bundled-workflows)
- [Bundled command templates](#bundled-command-templates)
- [Tool names](#tool-names)
- [Limitations & deferred](#limitations--deferred)
- [Development](#development)

---

## What it is

`daddy` (Respectfully inspired by coleam00/archon and nicobailon/pi-subagents ) is a native pi.dev extension. A workflow is a YAML file describing **nodes** (steps)
and their **dependencies**. The engine:

1. Parses and validates the workflow (duplicate ids, unknown deps, cycles, node shape).
2. Topologically groups nodes into **layers**; nodes in the same layer run in parallel
   (bounded by a concurrency semaphore).
3. Runs each node by type. **AI nodes** (`prompt`, `command`, `loop`) spawn an isolated
   `pi --mode json -p --no-session` subprocess. **Deterministic nodes** (`bash`, `script`,
   `approval`, `cancel`) run in-process.
4. Persists run state to `.daddy/runs/<id>.json` after every layer, so a run can **pause**
   (at an approval gate) and **resume** later, skipping completed nodes.

Outputs of completed nodes flow into later nodes via `$id.output` substitution.

## Install & load

The extension lives at `~/.pi/agent/extensions/daddy/`. pi auto-discovers everything under
the extensions directory listed in `~/.pi/agent/settings.json`:

```json
{ "extensions": ["~/.pi/agent/extensions/"] }
```

Extensions load at startup, so **after creating or editing the extension you must restart pi**.

Dependencies are installed with `npm install` inside the extension folder (already vendored
in `node_modules/`, ignored by git).

## Quick start

From any project directory, with pi running there:

```
/daddy flow=smoke the weather in Madrid is sunny
```

`smoke` is a bundled, side-effect-free workflow (bash + one AI step + an approval gate). It
will run, then pause at the gate. Approve to finish:

```
/daddy approve
```

List everything available:

```
/daddy list
```

## The `/daddy` command

Syntax: `/daddy <subcommand> [args]`

| Subcommand           | Example                     | What it does                                                                                           |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `flow=<name> [args]` | `/daddy flow=fix-issue #42` | Start a workflow. `args` becomes `$ARGUMENTS`.                                                         |
| `list`               | `/daddy list`               | List discoverable workflows (name + description).                                                      |
| `status`             | `/daddy status`             | List runs and their state.                                                                             |
| `resume <id>`        | `/daddy resume mqb…`        | Resume a paused/failed run by id.                                                                      |
| `approve [comment]`  | `/daddy approve lgtm`       | Approve the paused gate; `comment` becomes the gate output (default `approved`).                       |
| `reject [reason]`    | `/daddy reject not yet`     | Reject the paused gate (gate output `rejected`, or aborts the run if the gate has `on_reject: abort`). |
| `validate <name>`    | `/daddy validate fix-issue` | Parse + validate a workflow without running it.                                                        |
| `merge`              | `/daddy merge`              | `wt merge --yes` the current worktree.                                                                 |
| `remove`             | `/daddy remove`             | `wt remove` the most recent run's worktree.                                                            |
| `keep`               | `/daddy keep`               | No-op acknowledgement (keep the worktree).                                                             |

`approve`/`reject` with no id act on the most recent **paused** run.

## The `daddy` tool (for agents)

The extension also registers a `daddy` tool so the main agent can start a workflow itself:

```jsonc
// parameters
{ "flow": "fix-issue", "arguments": "#42" } // arguments is optional
```

It returns a plain-text per-node summary and the full run state in `details`.

## Workflow file format

A workflow is a YAML object. Minimal example:

```yaml
name: hello
description: Minimal example
nodes:
  - id: greet
    bash: 'echo "hi $ARGUMENTS"'
  - id: summarize
    prompt: "Summarize in one word: $greet.output"
    depends_on: [greet]
```

### Top-level fields

| Field                | Type   | Default | Notes                                                                 |
| -------------------- | ------ | ------- | --------------------------------------------------------------------- |
| `name`               | string | —       | **Required.**                                                         |
| `description`        | string | —       | **Required.** Shown by `list`.                                        |
| `nodes`              | list   | —       | **Required**, non-empty.                                              |
| `worktree`           | bool   | `false` | Create an isolated `wt` worktree for the run.                         |
| `concurrency`        | number | `4`     | Max parallel nodes per layer.                                         |
| `model` / `provider` | string | —       | Reserved (see [Limitations](#limitations--deferred) — not yet wired). |
| `persist_sessions`   | bool   | `false` | Reserved (deferred).                                                  |

### Node types

Every node has exactly **one** type field:

| Type     | Field              | Runs as                  | Purpose                                                     |
| -------- | ------------------ | ------------------------ | ----------------------------------------------------------- |
| prompt   | `prompt: <text>`   | isolated `pi` subprocess | Free-form AI task.                                          |
| command  | `command: <name>`  | isolated `pi` subprocess | Loads a `.md` command template, then runs it as an AI task. |
| bash     | `bash: <script>`   | in-process `bash -c`     | Deterministic shell.                                        |
| script   | `script: {…}`      | in-process `bun`/`uv`    | Run a `bun` (JS/TS) or `uv` (Python) script.                |
| loop     | `loop: {…}`        | repeated AI subprocess   | Iterate an AI task until a completion signal.               |
| approval | `approval: {…}`    | in-process               | Pause the run for a human decision.                         |
| cancel   | `cancel: <reason>` | in-process               | Cancel the run with a reason.                               |

### Common node fields

| Field                | Applies to     | Notes                                                                             |
| -------------------- | -------------- | --------------------------------------------------------------------------------- |
| `id`                 | all            | **Required**, unique.                                                             |
| `depends_on`         | all            | List of node ids that must run first.                                             |
| `when`               | all            | Skip the node unless the expression is true (see [Conditions](#conditions-when)). |
| `trigger_rule`       | all            | Join semantics over deps (see [Trigger rules](#trigger-rules-join-semantics)).    |
| `always_run`         | all            | Re-run even if previously completed (e.g. on resume).                             |
| `model` / `provider` | AI nodes       | Override the session model for this node.                                         |
| `thinking`           | AI nodes       | `low` \| `medium` (default) \| `high`.                                            |
| `output_format`      | prompt/command | JSON schema to validate the output (see [Structured output](#structured-output)). |
| `allowed_tools`      | AI nodes       | Allowlist of pi tools the node may use (see [Tool names](#tool-names)).           |
| `retry`              | non-loop nodes | Retry policy (see [Retries](#retries)).                                           |

## Variable substitution

Any node text (`prompt`, `bash`, `cancel`, `approval.message`, loop `prompt`/`until_bash`,
command templates, inline scripts) is substituted before running.

**Built-in variables:**

| Variable            | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| `$ARGUMENTS`        | The `args` passed to `flow=…`.                        |
| `$ARTIFACTS_DIR`    | Per-run shared scratch dir (`.daddy/artifacts/<id>`). |
| `$BASE_BRANCH`      | Detected repository base branch.                      |
| `$WORKFLOW_ID`      | The run id.                                           |
| `$RUN_DIR`          | `.daddy/runs`.                                        |
| `$DOCS_DIR`         | `docs`.                                               |
| `$LOOP_PREV_OUTPUT` | (loop nodes) the previous iteration's output.         |

**Node outputs** (only for nodes already `completed`):

- `$id.output` — the full text output of node `id` (hyphens in ids are supported, e.g.
  `$review-gate.output`).
- `$id.output.field` — a field of node `id`'s **structured** output (requires `output_format`).

Unknown variables are left intact. In `bash` nodes, built-ins are injected as environment
variables and node outputs are inserted **shell-quoted**; in `script` nodes the substitution
is raw (unquoted), so quote inside your code.

## Conditions (`when:`)

`when:` gates whether a node runs. Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`,
combined with `&&` and `||` (`&&` binds tighter). Comparisons are string-based unless both
sides are numeric. **Fails closed**: an invalid or unparseable expression evaluates to `false`.

```yaml
- id: create-pr
  bash: "gh pr create …"
  depends_on: [review-gate]
  when: "$review-gate.output != 'rejected'"
```

## Trigger rules (join semantics)

When a node has multiple `depends_on`, `trigger_rule` decides whether it runs:

| Rule                          | Runs when                                                                |
| ----------------------------- | ------------------------------------------------------------------------ |
| `all_success` (default)       | every dep `completed`.                                                   |
| `one_success`                 | at least one dep `completed`.                                            |
| `all_done`                    | every dep reached a terminal state (completed/failed/cancelled/skipped). |
| `none_failed_min_one_success` | no dep failed/cancelled **and** at least one completed.                  |

A node whose trigger rule isn't satisfied is marked `skipped`.

## Structured output

Add `output_format` (a JSON schema subset: `type`, `properties`, `required`, `enum`, `items`)
to a `prompt`/`command` node. The engine extracts JSON from the model output (raw or from a

````json fenced block), checks the top-level type and required fields. On success the parsed
object is exposed as the node's structured output (`$id.output.field`); on failure the node
**fails**.

```yaml
- id: classify
  prompt: "Classify and respond with JSON only: $ARGUMENTS"
  output_format:
    type: object
    properties:
      type: { type: string, enum: [bug, feature, refactor, docs] }
    required: [type]
````

## Loops

A `loop` node repeats an AI task until a completion signal or a shell check passes:

```yaml
- id: verify
  loop:
    prompt: |
      Run the tests; fix failures. Previous attempt: $LOOP_PREV_OUTPUT
      When all tests pass, end with <promise>COMPLETE</promise>.
    until: COMPLETE # detected from a <promise>…</promise> tag or trailing token
    until_bash: "bun test" # optional: also complete when this exits 0
    max_iterations: 5 # required; failing to converge fails the node
```

Completion is detected from a `<promise>SIGNAL</promise>` tag (or a trailing plain signal).
Without `until`, the defaults are `ALL_TASKS_COMPLETE`, `APPROVED`, `DONE`, `COMPLETE`. The
signal tags are stripped from the stored output.

## Approval gates: pause & resume

An `approval` node pauses the whole run (the command handler persists state and returns; it
never blocks on the UI). A later `/daddy approve|reject` reloads state and continues.

```yaml
- id: review-gate
  approval:
    message: "Implementation done. Approve to open a PR, reject to abort."
    on_reject: abort # optional: 'abort' cancels the run; otherwise gate output = 'rejected'
  depends_on: [test]
```

- **approve** → gate output = your comment (or `approved`); the DAG continues.
- **reject** → if `on_reject: abort`, the run is cancelled; otherwise gate output = `rejected`
  and downstream `when:` branches handle routing (e.g. a `cancel` node).

On the next pi startup, a paused run is announced via a notification.

## Retries

Non-loop nodes accept a `retry` policy. Errors are classified `fatal` (auth/permission),
`transient` (timeouts/rate-limit/network/non-zero exit), or `unknown`.

```yaml
- id: flaky
  bash: "./sometimes-fails.sh"
  retry:
    max_attempts: 3 # 1–5, default 2
    delay_ms: 3000 # base backoff (exponential), clamped 1000–60000
    on_error: transient # 'transient' (default) retries transient only; 'all' retries all non-fatal
```

`fatal` errors are never retried.

## Worktrees

Set `worktree: true` to run the workflow in an isolated `wt` worktree (branch
`daddy/<slug>-<hash>`). AI/bash nodes run with the worktree as their working directory.
Use `/daddy merge` and `/daddy remove` to integrate or discard it afterward.

## Per-node models

Each AI node resolves its model as `node.model ?? session default` (same for `provider`,
and `thinking` defaults to `medium`). Mix models per step:

```yaml
- id: classify
  prompt: "Classify: $ARGUMENTS"
  provider: minimax
  model: MiniMax-M3
  thinking: low
- id: deep-review
  prompt: "Deep review: $classify.output"
  provider: google
  model: gemini-3-pro-preview
  thinking: high
  depends_on: [classify]
```

`provider` + `model` map to pi's `--provider`/`--model`. Omit them to inherit the model
active in your pi session.

## Discovery & overriding

Workflows and command templates are resolved from, in order:

1. `<project>/.daddy/workflows/<name>.yaml` and `<project>/.daddy/commands/<name>.md`
2. the bundled `workflows/` and `commands/` shipped with the extension

A project-level file with the same name **overrides** the bundled one. Drop your own
workflow in `<project>/.daddy/workflows/` to make it available as `/daddy flow=<name>`.

## State, runs & artifacts

Everything for a run lives under the project's `.daddy/` directory:

- `.daddy/runs/<id>.json` — full run state (node statuses, outputs, pause point). Written
  after every layer, so it doubles as a monitoring file.
- `.daddy/artifacts/<id>/` — shared scratch dir (`$ARTIFACTS_DIR`) for designs, plans, etc.

`.daddy/` is git-ignored by the extension's own `.gitignore`; add it to your project's
ignore rules too if you don't want runs committed.

## Live feedback

While a run executes, the extension updates pi's live working indicator
(`ctx.ui.setWorkingMessage`) with the current layer ("running design (1/6)") and streams the
active AI node's latest output. (Chat messages don't render until a handler returns, so the
working indicator is the live channel.) A final per-node summary is shown when the run
pauses or completes.

## Configuration (`config.yml`)

Optional, in the extension folder. Defaults shown:

```yaml
engine:
  concurrency: 4 # max parallel nodes per layer
  node_timeout_ms: 600000 # per-node timeout (10 min)
  loop_idle_ms: 1800000 # per-iteration loop timeout (30 min)
```

## Bundled workflows

| Name          | Worktree | Summary                                                                                 |
| ------------- | -------- | --------------------------------------------------------------------------------------- |
| `smoke`       | no       | Safe end-to-end check: bash + one AI prompt + an approval gate. No `gh`, no worktree.   |
| `fix-issue`   | yes      | classify → investigate → implement → test → **gate** → open PR / abort.                 |
| `feature-dev` | yes      | plan → implement → test-loop → **gate** → open PR.                                      |
| `pr-review`   | no       | fetch diff → 3 parallel reviews (quality/security/architecture) → synthesize → comment. |

> `fix-issue`, `feature-dev`, and `pr-review` perform real side effects (`wt` worktrees,
> `gh` PRs/comments). Use `smoke` for a first, side-effect-free run.

## Bundled command templates

Reusable `.md` prompts referenced by `command:` nodes: `investigate-issue`,
`implement-feature`, `review-code`.

## Tool names

`allowed_tools` is an **allowlist** of real pi tool names. pi's built-in tools are
`read`, `write`, `edit`, `bash`, `curl` (plus tools registered by other extensions). There is
**no** `grep`/`find`/`ls`/`glob` tool — do those via `bash`. `ask_user_question` is always
removed from AI nodes (they run non-interactively). Omitting `allowed_tools` gives the node
pi's full default toolset.

## Limitations & deferred

- **Workflow-level `model`/`provider`** are defined but not yet wired; only per-node and
  session defaults take effect.
- **`persist_sessions` / per-node session resume**: the runner uses `--no-session`, so a
  failed node is re-run from scratch on resume (artifacts carry state forward).
- **`on_reject` AI-rework loop**: v1 reject is a `rejected` branch or `abort`; no automatic
  rework prompt.
- **Reserved builtins** `REJECTION_REASON` / `LOOP_USER_INPUT` are declared but not populated.
- **Custom TUI panel**: results are plain-text summaries; no custom render component.

## Development

```bash
cd ~/.pi/agent/extensions/daddy
bun test            # unit suite
bun test --coverage # coverage
npx tsc --noEmit    # typecheck
bun test ./tests/integration/<file>.itest.ts  # integration (needs authenticated pi / wt / gh)
```

One source file = one responsibility, each with a co-located `*.test.ts`. Integration suites
use the `.itest.ts` suffix and are excluded from the default `bun test` run.
