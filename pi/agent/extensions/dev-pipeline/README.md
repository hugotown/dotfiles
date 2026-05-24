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
