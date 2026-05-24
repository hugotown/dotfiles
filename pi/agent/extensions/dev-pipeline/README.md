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
2. Brainstorm — **the only human-in-the-loop step**: the model researches first (project state via eza/rg/ast-grep/graphify, and best practices via the `ddg` web-search CLI, exhaustively), then resolves EVERY decision (architecture, functional + non-functional requirements, business rules, UX/UI, color psychology) via the `ask_user_question` tool. Every question carries a pre-filled best-practice recommendation (`default`) plus its rationale (`reasoning`, citing the web finding + how it fits the project). No fixed number of questions: it closes only when BOTH the model and you confirm there are no remaining doubts.
3. Write + STRICT self-review the design spec → advances automatically (no human gate).
4. Decide research → deep-research EACH library in its own clean-context turn (Context7 via `ctx7` for version+topic examples; `ddg` dorking to GitHub/docs for libraries Context7 lacks — common for Python/Go/Rust), retrying a library until the model self-declares HIGH confidence → run base research deterministically (rg, ast-grep, `ddg` best-practice searches) → write + STRICT self-review the plan → advances automatically.
5. Implement task-by-task with TDD (tests verified by the extension); halts BLOCKED if a task can't pass honestly.
6. Review the working-tree `git diff` → verdict.
7. Write implementation notes.

Every phase after the brainstorm is forbidden from asking the user anything — all decisions are
finalized up front, and the strict self-reviews replace the former human approval gates.

Web best-practice research uses the `ddg` CLI through a proxy. It needs `DI_LOGIN`, `DI_SEC`,
`DI_HOST`, `DI_PORT` in the environment (loaded from SOPS via `~/.config/shell/env.zsh`). If they
are absent, the brainstorm falls back to the model's own knowledge and the plan's deterministic
`ddg` step is skipped — both note it explicitly rather than failing.

Artifacts land in `~/obsidian/Documents/<mangled-cwd>/<date>-<slug>-<type>.md`.
**Nothing is committed** — review the working tree and commit manually.

## Models

- sonnet (`github-copilot/claude-sonnet-4.6`): brainstorm, plan-research, library-research, implement, notes.
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
