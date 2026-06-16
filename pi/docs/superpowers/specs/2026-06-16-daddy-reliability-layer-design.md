# Daddy Reliability Layer Design

## Context

`daddy` is a Pi extension for YAML-defined workflow DAGs. It already supports deterministic and AI nodes, dependency-based execution, approval gates, retries, loops, worktree isolation, artifacts, and a TUI panel.

The `nicobailon/pi-subagents` repository is broader: it focuses on general-purpose subagent orchestration, builtin agents, chains, background runs, intercom, doctor diagnostics, status/control actions, worktree isolation, session sharing, and acceptance gates.

The goal is not to turn `daddy` into a clone of `pi-subagents`. The valuable direction is to make `daddy` a trustworthy runtime for real DAG workflows: inspectable, recoverable, auditable, and safe to run.

## Design Principles

- Keep `daddy` centered on deterministic YAML workflow DAGs.
- Prefer operational confidence over adding another agent abstraction.
- Make every long-running workflow diagnosable and recoverable.
- Distinguish model claims from runtime-verified evidence.
- Keep UI features focused on preflight and control, not a full visual builder.

## Proposed Feature Set

### 1. Doctor And Deep Status

Add `/daddy doctor` and expand `/daddy status [id]`.

`/daddy doctor` should check:

- Expected directories: `.daddy/runs`, `.daddy/artifacts`, project workflows, and command templates.
- Discoverable workflow validity.
- External dependencies used by bundled or project workflows, such as `pi`, `wt`, `gh`, `bun`, and `uv`.
- Extension config validity from `config.yml`.
- Inconsistent runs, such as stale `running` states, paused runs with missing nodes, or worktrees that no longer exist.
- Documentation/runtime drift when it can be detected cheaply.

`/daddy status [id]` should show:

- Workflow status and current blocking node.
- Per-node status, attempts, model, duration, structured output presence, and error.
- Worktree path, branch, artifact directory, and run file path.
- Next available actions such as `resume`, `approve`, `reject`, `cancel`, `remove`, or `merge`.

Success criterion: when a workflow fails or pauses, the user can immediately understand what happened and what action is safe next.

### 2. Run Control And Recovery

Add explicit lifecycle control for workflow runs.

Commands:

- `/daddy cancel [id] [reason]`: mark a run as cancelled, abort it when possible, and preserve artifacts.
- `/daddy recover [id]`: reconcile obvious stale states, such as old `running` runs with no live process.
- `/daddy retry <id> <node>`: re-run a failed node and downstream dependent nodes while respecting `always_run`.
- `/daddy cleanup`: list or remove old runs/artifacts using safe defaults and without deleting active worktrees.

Panel behavior:

- Show contextual actions for paused, failed, cancelled, and completed runs.
- Keep artifacts and state paths visible so failures are inspectable.

Success criterion: no run should remain ambiguous. It should have a terminal state, a clear next action, or a clear explanation.

### 3. Acceptance Gates

Add workflow-level and node-level `acceptance` configuration for AI-producing nodes and critical deterministic nodes.

Example:

```yaml
acceptance:
  level: checked
  criteria:
    - "Bug fixed without widening scope"
  evidence:
    - changed-files
    - tests-run
    - residual-risks
  verify:
    - id: unit
      command: "bun test"
      timeout_ms: 120000
```

Levels:

- `none`: explicitly disabled, with a reason.
- `attested`: the node returns structured evidence.
- `checked`: the runtime validates required evidence shape or artifacts.
- `verified`: the runtime executes configured verification commands.
- `reviewed`: an independent reviewer or approval gate validates the output.

Runtime provenance should distinguish:

- `claimed`: child prose says work is done, but no structured evidence was provided.
- `attested`: structured evidence was provided.
- `checked`: runtime structural checks passed.
- `verified`: runtime verification commands passed.
- `reviewed`: independent review or gate passed.
- `rejected`: evidence, checks, verification, or review failed.

Success criterion: final summaries report acceptance provenance per relevant node. Model prose alone never counts as verified evidence.

### 4. DAG Preflight Preview

Add an optional preflight view before running side-effectful workflows.

The preflight should show:

- Nodes and dependencies.
- Worktree usage.
- Commands, tools, models, and concurrency.
- Side effects detected from workflow text, such as `gh pr create`, `wt merge`, or risky shell commands.
- Missing or weak acceptance configuration.

Allowed preflight edits for the first iteration:

- Edit `$ARGUMENTS`.
- Override model, thinking, or concurrency for this run.
- Confirm or cancel execution.

Non-goal: a full visual workflow builder.

Success criterion: before running bundled workflows like `fix-issue` or `feature-dev`, the user understands the DAG and its risk profile without reading YAML.

### 5. Selective Agent And Session Interop

Keep interop narrow and avoid duplicating `pi-subagents`.

Possible additions:

- Clarify and wire `context: fresh | shared` semantics, or remove it if unsupported.
- Implement `persist_sessions` so AI nodes can save and resume per-node session state instead of always using `--no-session`.
- Consider a future `agent` node or lightweight fields such as `reads`, `output`, and `context` only if they map cleanly to existing `daddy` workflow semantics.
- Defer `.chain.md` import/adapters until there is real demand.

Success criterion: `daddy` can benefit from stronger session behavior without losing its identity as a deterministic DAG workflow runtime.

## Recommended Delivery Order

1. Doctor and deep status.
2. Run control and recovery.
3. Acceptance gates.
4. DAG preflight preview.
5. Selective session/agent interop.

This order builds trust before adding surface area. A workflow runtime that cannot explain or recover its own state should not grow more workflow features yet.

## Open Risks

- `retry <id> <node>` requires careful downstream invalidation semantics.
- Acceptance gates can become too heavy if every node requires configuration.
- Preflight side-effect detection should be heuristic and clearly labeled, not presented as a perfect security scanner.
- Session persistence may require compatibility checks with Pi session file behavior.

## Explicit Non-Goals

- Reimplementing `pi-subagents` agents and chain DSL inside `daddy`.
- Building a full visual DAG editor in the first iteration.
- Treating model-generated prose as runtime verification.
- Adding broad compatibility abstractions before core run reliability is strong.
