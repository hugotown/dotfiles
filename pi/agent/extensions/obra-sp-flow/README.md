# obra-sp-flow

One command runs the full **superpowers** pipeline end-to-end, from a single idea:

```
brainstorm → plan → branch → implement → review → verify → (debug loop) → finish
```

The extension owns **orchestration only**. For most phases the "how" lives in the
superpowers `SKILL.md` files (loaded fresh from disk). **Brainstorm is different:**
it was rebuilt as a **code-driven node machine** with a *distilled* core (no raw
SKILL.md, a fraction of the tokens) — see "Brainstorm node machine" below. Each
non-interactive step runs as an isolated child `pi` process; the controller session
only drives the state machine.

---

## Commands

| Command | What it does |
|---|---|
| `/obra-sp-flow <idea>` | Run the whole pipeline from one idea. Brainstorm is interactive; everything after is autonomous. |
| `/obra-sp-flow-init` | Scaffold `{project}/.pi/obra-sp-flow/obra-sp-flow.yml` from defaults, pre-filling a curated tool set per phase. Edit it, then restart pi. |

---

## Architecture

A small, event-sourced state machine. Drivers compute the next event; the reducer
applies it; the orchestrator persists every transition into the pi session.

```
index.ts        Wiring: registers the command + tools, the advance() loop, and
                hooks (context / agent_end / session_start). Owns try/catch.
reducer.ts      Pure state machine: createInitialState + transition (no I/O).
drive.ts        Phase router: dispatches the current phase to its driver.
orchestrator.ts Session-bound glue: persist/restore (event-sourced), context
                windowing (phase markers), per-phase model/tool routing.
types.ts        Single source of truth for all contracts (FlowState, Config, …).
config.yml      Built-in defaults (models, limits, checks, branch, finish).

phases/         One driver per step:
  brainstorm.ts   code-driven node machine (grounding → questions → stories → spec)
  brainstorm/     pure node logic: types, ledger, compress, conductor, stories,
                  spec-validate, grounding (deterministic filesystem inspection)
  plan.ts         code-driven node machine (research → plandraft → validate)
  plan/           pure node logic: types, plan-validate, contracts (fallback extraction)
  branch.ts       deterministic git branch (idempotent)
  implement.ts    parallel-by-DAG, 1 agent = 1 file
  review.ts       consolidated review + fix
  verify.ts       deterministic checks (hybrid command resolution)
  debug.ts        systematic-debugging circuit (budgeted)
  finish.ts       pr | merge | keep

tools/index.ts  obra_spec + obra_stories — brainstorm's commit tools (validates + dedups H1).
commands/init.ts  the /obra-sp-flow-init scaffolder.
cores/          distilled skill cores (.md): brainstorming.md, writing-plans.md

lib/
  spawn-pi.ts      runs an isolated child pi (json, --no-session, --no-skills) + TIMEOUT
  pool.ts          bounded-concurrency map (implement fan-out)
  dag.ts           topological levels from file-contract dependsOn
  checks.ts        runs the resolved check commands (deterministic verdict)
  detect.ts        heuristic check-command detection (pkg-manager/monorepo aware)
  resolve-checks.ts hybrid resolution: config → heuristic → LLM fallback
  yml-write.ts     persists LLM-resolved commands back to the project yml
  observability.ts per-feature jsonl trace under .pi/obra-sp-flow/logs
  metrics.ts       token telemetry side-channel + COMPLETE report
  config-load.ts   loads defaults + deep-merges the trusted project override
  paths.ts         canonical artifact locations
  repo-context.ts  precomputed repo map injected into LLM phases
  skill-loader.ts  reads SKILL.md fresh + autonomous wrapper (non-brainstorm phases)
  cores.ts         loads distilled skill cores from cores/*.md (brainstorm)
  progress.ts      chat feedback (announce) + live indicator (working) — 0 LLM tokens
  rules.ts/tools.ts/task-runner.ts/git.ts/json-extract.ts  small helpers
```

### State machine

```
IDLE → BRAINSTORM → PLAN → BRANCH → IMPLEMENT → REVIEW → VERIFY
                                                            │
                                          passed ──────────► FINISH → COMPLETE
                                          failed ──► DEBUG ──► VERIFY (loop)
                                                       │
                                       budget exceeded ► COMPLETE (escalation)
```

State is **event-sourced in the pi session**: every transition appends an
`obra-sp-flow-state` custom entry (`orchestrator.persist`). `restore()` reads the
**last** one. To reconstruct any run, read the session `.jsonl` and follow the
`obra-sp-flow-state` entries. Token metrics are a separate side-channel
(`obra-sp-flow-metric` entries), summarized to a report at COMPLETE.

---

## Pipeline phases

| Phase | Interactive | Default model (config.yml) | Output / effect |
|---|---|---|---|
| brainstorm | **yes** (questions only) | per-node (see below) | grounding (deterministic) → questions → stories → spec; resolves ALL ambiguity |
| plan | no (isolated) | plan / plan_research | research → plandraft → validate; plan md + file contracts |
| branch | no (deterministic) | — | feature branch (standard, never worktree) |
| implement | no | minimax/MiniMax-M2.7-highspeed | files (parallel by DAG, 1 agent/file) |
| review | no | claude-opus-4-8 | applies fixes, reports remaining issues |
| verify | no (deterministic) | — | runs the check commands |
| debug | no | minimax/MiniMax-M3 | root-cause fixes, budgeted, loops to verify |
| finish | no (deterministic) | — | PR / merge / keep |

Artifacts:
- spec → `docs/superpowers/specs/<date>-<slug>-design.md`
- plan → `docs/superpowers/plans/<date>-<slug>.md`
- metrics → `docs/superpowers/metrics/<date>-<slug>.json` (at COMPLETE)
- observability → `.pi/obra-sp-flow/logs/<iso>_<slug>.jsonl`
- project config → `.pi/obra-sp-flow/obra-sp-flow.yml`

---

## Brainstorm node machine

Brainstorm was rebuilt from "inject the raw SKILL.md and let the LLM drive" into a
**code-driven node machine**: the controller owns transitions, the model only
creates. Four nodes run, persisted in `scratch.brainstorm` (event-sourced):

```
grounding (deterministic)  →  questions (controller, ask-only)  →  stories (generate)  →  spec (commit)
```

- **grounding** — **100% deterministic** (no LLM, no child pi). Runs
  `eza --tree --level=3`, detects the stack by manifest presence, and reads key
  config files. Produces a compact `repoUnderstanding` string in milliseconds.
  Detection covers: package.json, Cargo.toml, go.mod, pyproject.toml, Gemfile,
  composer.json, build.gradle(.kts), pom.xml, pubspec.yaml, mix.exs, deno.json,
  plus design-affecting configs (tsconfig, biome, vite/next/nuxt configs, turbo.json,
  prisma schema, mise.toml, etc.). Manifests searched up to 3 levels deep; configs
  up to 2 levels. Capped at 10 manifests (5 read, rest listed). See
  `phases/brainstorm/grounding.ts`.
- **questions** — runs in the controller (needs the UI). Allowlist is **only
  `ask_user_question`** (no exploration), so nothing noisy renders; it relies on
  `repoUnderstanding` and asks when something is missing. Each round folds into a
  compact **ledger** (`ledger.ts`); the `context` hook re-injects only
  `[marker + ledger]` per round (`compress.ts`) so the dialogue stays flat. **No
  round cap** — it ends only at zero ambiguity, from BOTH sides:
  - the model sets `done=true` when it has no more questions;
  - the harness then opens a **0-token user gate** (`ctx.ui.input`) for the user's
    own doubts; a non-empty answer reopens the loop.
- **stories** — runs in the controller. Allowlist is **only `obra_stories`**.
  Generates user stories in Given/When/Then (Gherkin) format from the resolved
  ledger. `obra_stories` validates structural completeness (at least one story with
  role + Given/When/Then) and rejects without terminating so the model fixes and
  re-calls. The produced stories are stored in `scratch.brainstorm.userStories` and
  injected into the spec node's prompt. See `phases/brainstorm/stories.ts`.
- **spec** — allowlist `obra_spec` (+ read). `obra_spec` runs a deterministic
  **quality gate** (`spec-validate.ts`): an incomplete spec is rejected
  (`terminate:false`, `specReady` stays false) so the model fixes and re-calls.
  The gate now also requires acceptance criteria with Given/When/Then scenarios.

**Per-node models:** `brainstorm_questions` / `brainstorm_spec` (each falls back to
`brainstorm`). Grounding no longer uses an LLM. Route a cheap model to questions and
a strong one to spec.

**Live feedback:** every node `announce()`s its milestone to the main chat
(`lib/progress.ts`) — visual-only `obra-sp-flow-progress` entries the `context`
hook strips, so they cost 0 LLM tokens.

---

## Plan node machine

Plan mirrors the brainstorm pattern but is **fully autonomous** (every node is a
child pi), so `plan.ts` is a simple sequential driver — no controller turns, no
hooks:

```
research (isolated, Gemini-grounded)  →  plandraft (isolated)  →  validate (code, retry)
```

- **research** — a child (Gemini + read-only tools) grounds every technical
  decision against real docs and the codebase AS_IS, returning a concise
  `researchDigest`. The **HARD research gate** lives here: an ungrounded required
  decision ends with `STATUS: ABORT` → the phase escalates (never plan on guesses).
- **plandraft** — a child (file tools) writes the plan (bite-sized TDD tasks +
  file contracts) from spec + digest.
- **validate** — deterministic, STRUCTURAL only (`plan/plan-validate.ts`): length,
  header (Goal/Architecture), a test strategy, and a non-empty file-contracts array.
  Contracts are read from the plan FILE's `## File Contracts` json (the model writes
  the whole plan to disk and rarely repeats the json in its final message), with a
  fallback that derives them from the plan's `Create:/Modify:/Test:` lines
  (`plan/contracts.ts`). On failure it feeds the reasons back and retries plandraft
  (up to 2), else escalates. No regex placeholder gate — see gotcha 22.

Models: `plan` (plandraft) + `plan_research` (inherits `plan`). State in
`scratch.plan`. Feedback: `announce()` (chat record) + `working()` (live indicator,
since announces queue up while an autonomous handler is busy) per node.

---

## Configuration

Defaults live in `config.yml`. A **trusted** project may override any of them in
`{project}/.pi/obra-sp-flow/obra-sp-flow.yml` (deep-merged; project wins).
Scalars support `"$ENV_VAR"` and `"$ENV_VAR:fallback"`.

Key sections:
- `phases.<phase>` — `provider` / `model` (must exist in pi enabledModels),
  `thinking`, `rules` (lines injected into that phase's prompt), `tools`
  (allowlist override; empty = code default from `lib/tools.ts`).
  - Brainstorm accepts **per-node** overrides `brainstorm_grounding`,
    `brainstorm_questions`, `brainstorm_spec` — each inherits `brainstorm` when
    omitted. (The brainstorm `tools` are fixed in code per node; the yml `tools`
    for brainstorm are ignored — see gotcha 17.)
- `limits` — `impl_concurrency`, `debug_subcycles_per_error` (5),
  `debug_global_cap` (15), `question_architecture_threshold` (3),
  `coverage_threshold` (90), **`child_timeout_ms` (600000)**.
- `checks` — `build`, `typecheck`, `test`, `lint`, `format` (see below).
- `branch` — `prefix`, `base`. `finish` — `action: pr|merge|keep`.
- `skills_dir` — where the superpowers `SKILL.md` files live.

---

## Verification gate (`verify` + `checks`)

Five checks run in **debugger-priority order** (debug attacks `failures[0]` first):

```
build → typecheck → test → lint → format
```

- `test` is **mandatory** (its absence is a FAILURE — "cannot verify", never a
  false green). The other four are optional (skipped when no tool is detected).
- Each command's **exit code is the only verdict.** An LLM never judges results.

**Hybrid command resolution** (`resolve-checks.ts`), per check:

1. explicit value in the project `checks` (always wins), else
2. heuristic detection by stack (`detect.ts`: package-manager- and monorepo-aware), else
3. **LLM fallback** — one read-only child proposes a *command string* (not a
   verdict) for unknown stacks (Cargo, uv, Gradle, …).

Any LLM-proposed command is written back to the project yml with a provenance
comment (`yml-write.ts`), e.g.:

```yaml
checks:
  typecheck: "turbo run check-types" # auto-detected by LLM 2026-06-11
```

---

## Observability

Every run writes an append-only `.jsonl` under `.pi/obra-sp-flow/logs/`. Events:
`start` / `resume`, `phase` (each transition), `spawn` / `spawn_error` (every
child: tag, model, exitCode, timedOut, durationMs), `checks_resolved`,
`checks_done`, `error`. **This is the trace to read first when a run misbehaves**
— child pis run with `--no-session`, so this log is their only durable record.

---

## Quirks & gotchas (read before changing anything)

1. **Child pis run with `--no-session`** — they leave no pi session file; their
   internal steps are invisible. The observability log + the child's captured
   `stderr` are your only forensic trail. (This is exactly why the log exists.)

2. **The child timeout is load-bearing — never remove it.** Before it existed, a
   stalled debug subagent hung the pipeline indefinitely (the parent `await`ed a
   child that never returned). `runChildPi` now enforces `child_timeout_ms`
   (SIGTERM → SIGKILL grace) and returns `timedOut: true` (exitCode 124). The
   `debug` phase **escalates immediately** on a timeout instead of burning the
   retry budget.

3. **The VERIFY verdict must stay deterministic.** The LLM only chooses *which
   command to run*. Never let it judge whether types/tests pass — that
   reintroduces false greens and defeats the whole gate.

4. **Bare `tsc --noEmit` at a monorepo root is a trap.** It ignores per-package
   `tsconfig` (e.g. `jsx`) and emits false `TS17004`/type errors. `detect.ts`
   prefers the project's own script (`check-types`/`typecheck`) via the detected
   package manager and only uses bare `tsc` for a single-package repo. Don't
   reintroduce bare `tsc` for monorepos.

5. **Persisting to a yml must preserve comments.** `config-load.ts` uses `parse`
   (read-only, fine). `yml-write.ts` uses `parseDocument` + `setIn` +
   `pair.value.comment` so user comments/formatting survive. Never persist via
   `parse` + `stringify`.

6. **The repo-context symbol outline is capped (`SYMBOLS_CAP`) and alphabetical.**
   Late-sorting files get truncated out of the LLM's map. Tests asserting a
   specific symbol must pick an early one (adding files shifts the cut).

7. **`ast-grep` is a CLI, not a registered tool.** It's used via `bash`. Never
   list `ast-grep` in a tool allowlist (`lib/tools.ts`).

8. **Only the brainstorm `questions` node is interactive.** `grounding` is
   deterministic (no LLM); `spec` is a single commit; every later phase is an
   autonomous subagent (no human). All ambiguity must be resolved in brainstorm —
   see "Brainstorm node machine". The `agent_end` hook is the node **conductor**;
   `BRAINSTORM_DONE` fires only when `scratch.specReady` is set (by `obra_spec`).

9. **Context windowing + brainstorm compression.** The `context` hook trims to the
   last phase marker (`filterContext`) for most phases. In the brainstorm
   `questions` node it instead collapses to `[marker + ledger]` (`compress.ts`) —
   but ONLY once `rounds > 0`. Compressing before the first answered round erased
   the initial context; never compress before the first answered round. It ALSO
   strips `obra-sp-flow-progress` entries on EVERY call, including IDLE/COMPLETE
   (gotcha 23).

10. **Resume is selective.** On session resume/reload, only **deterministic**
    phases (BRANCH, VERIFY, FINISH) auto-re-drive. LLM/child phases (PLAN,
    IMPLEMENT, REVIEW, DEBUG) are left for the user to re-trigger, to avoid
    duplicate paid work.

11. **try/catch is hardening, not decoration.** A thrown phase escalates to
    COMPLETE (terminal) instead of freezing mid-flow; `runChildPi` setup failures
    return a failed result rather than throwing. Keep both.

12. **Implement guardrails.** A `BLOCKED` file is retried once with the stronger
    `implement_escalate` model. A file with no artifact on disk is forced
    `BLOCKED` (no "DONE" without a written file). DAG cycles dump the remainder
    into one final level.

13. **Debug budgets.** Per-error cap (`debug_subcycles_per_error`) + global cap
    (`debug_global_cap`). After `question_architecture_threshold` failures on the
    same error, the prompt flips to "question the architecture, not the symptom."

14. **Finish guards** (honor AGENTS.md): no force-push, refuses merge into
    protected branches (`main`/`master`/`trunk`), branches only (never worktrees).

15. **Skills load fresh from disk each phase** from `skills_dir`; a missing skill
    degrades to `""` (subagents still get the autonomous wrapper). **Brainstorm is
    the exception:** it loads a distilled in-extension core (`cores/brainstorming.md`
    via `lib/cores.ts`), not the external SKILL.md — the raw skill carried steps
    that fought the harness ("get approval", "write the doc", "invoke writing-plans").

16. **`ask_user_question` has no `terminate`, so the harness cuts the turn.** On
    `done=true`, `handleBrainstormToolResult` calls `ctx.abort()`. Without it the
    model re-calls `ask_user_question` with empty questions forever. The abort ends
    the turn → `agent_end` runs the user-doubt gate. Seeing **"Operation aborted"**
    in the chat on done is **expected, not an error**.

17. **The brainstorm `questions` allowlist must NOT include `write`/`edit`/`obra_spec`.**
    It is `["ask_user_question"]` only, set in code (`brainstorm.ts`), deliberately
    bypassing the project yml `tools`. This is what forces the model through the loop
    instead of writing the spec itself (the original stall). `grounding` is
    deterministic (no tools); `spec` is `["obra_spec","read"]`.

18. **`obra_spec` is a gate, not just a writer.** It validates the spec
    (`spec-validate.ts`: a Decisions section, a test strategy, a min length —
    STRUCTURAL only, no placeholder regex; gotcha 22) and rejects **without
    terminating** so the model fixes it. It also de-duplicates the H1 (only prepends
    `# {title}` when the spec lacks its own).

19. **Use a tool-calling-solid model for brainstorm.** MiniMax-M3 corrupted tool
    calls here (`]<]minimax[>[<invoke name=…`), breaking `ask_user_question` /
    `obra_spec`. Claude (e.g. `github-copilot/claude-opus-4.6`) works. Per-node model
    routing exists partly for this.

20. **Plan is a node machine, but sequential.** Unlike brainstorm, plan nodes are
    all child pis (`runChildPi`), so `drivePlan` just awaits them in order — no
    hooks. The research gate (`STATUS: ABORT`) and the `validate` retry loop (max 2)
    both **escalate** rather than ship a guessed/incomplete plan. Plan also needs a
    tool-calling-solid model (Gemini + file tools) — same lesson as gotcha 19, so set
    `plan`/`plan_research`, not just `brainstorm`.

21. **Every child pi runs with `--no-skills`.** Otherwise pi lists every SKILL.md in
    the child's system prompt and the model follows the raw one (e.g. writing-plans,
    with its "REQUIRED SUB-SKILL" header + "Execution Handoff"), which competes with
    — and overrides — the distilled core we inject via `--append-system-prompt`. Also
    saves tokens. Set in `lib/spawn-pi.ts`; applies to research / plandraft and the
    implement / review / debug subagents. (Brainstorm grounding no longer spawns a
    child — it is fully deterministic.)

22. **No regex placeholder gate.** `validatePlan` / `validateSpec` used to reject on
    `TBD|TODO|FIXME`, which a regex cannot tell from a *mention* — it false-rejected
    good docs on the project's `todoRouter` (lowercase "todo") and on the model's own
    self-review line ("Placeholder scan: no 'TBD'/'TODO'"). The gates are now
    STRUCTURAL only (length, header/sections, test strategy, contracts). The core
    still says "no placeholders"; trust the model + the structural checks, not a regex.

23. **Progress entries are stripped from the LLM context ALWAYS.** The `context` hook
    filters `obra-sp-flow-progress` on every call, including IDLE/COMPLETE. Skipping
    that at COMPLETE let a finished/escalated flow leave a dangling "🔬 …" line that
    the restored controller LLM read as a user instruction and acted on (it re-ran
    writing-plans by hand). **Latent risk:** after COMPLETE the controller regains its
    skills and could still react to leftover context — the real defense is keeping the
    happy path from escalating; consider clearing context in `driveComplete`.

---

## How to extend

**Add a verification check (e.g. `securityaudit`):**
1. `config.yml` → add it under `checks`.
2. `types.ts` → add the field to `Config["checks"]`.
3. `config-load.ts` → add it in `toConfig().checks`.
4. `detect.ts` → add a `detect<Name>(cwd)` (return `""` when unknown).
5. `resolve-checks.ts` → add to `NAMES` + `DETECTORS`.
6. `checks.ts` → add a `consider(resolved.<name>, "<name>", mandatory?)`
   line in the right priority position.

**Add a detector for a new stack:** extend the relevant `detect*` in `detect.ts`.
Unknown stacks fall through to the LLM fallback automatically.

**Add a pipeline phase:** extend `Phase`/`PhaseKey` (types.ts), add transitions
(reducer.ts), write `phases/<x>.ts`, wire it in `drive.ts`, add its model block
to `config.yml` + `config-load.ts`, and add the `FlowEvent`(s) it emits.

**Change a phase's model / thinking / tools / rules:** edit `config.yml` (or the
project override). Models must exist in your pi `enabledModels`.

**Tune behavior:** `config.yml` → `limits` (timeout, debug caps, concurrency,
coverage), `branch`, `finish`.

---

## Testing & verification

```bash
bun test                      # unit tests in tests/
./node_modules/.bin/tsc --noEmit   # typecheck (package script: "typecheck")
```

Both must be green before shipping a change. The test suite covers the reducer,
config loading, detection, checks, the DAG, paths, tools, and repo-context.

---

## Hardening history

The anti-hang work (timeout + escalation + try/catch), the monorepo-aware check
detection, the hybrid LLM command resolution with yml persistence, and the
per-project observability log were added after a run hung overnight in DEBUG: a
debug subagent was spawned to fix **false-positive** typecheck errors (bare `tsc`
at a monorepo root) and never returned, because `runChildPi` had no timeout. Each
gotcha above traces back to a concrete failure mode from that incident — treat
them as load-bearing.

The **brainstorm node-machine rewrite** came from a second incident: the raw
`brainstorming` SKILL.md drove the controller to (a) explore 87 times and loop
because compression wiped its grounding memory, (b) render all its raw reasoning in
the chat, (c) re-ask empty `ask_user_question` rounds on done, and (d) — with
MiniMax-M3 — corrupt tool calls outright. Gotchas 8-9 and 15-19 each trace to that
run. The fixes (isolated grounding, ask-only questions node, compress-after-first-
round, abort-on-done, the `obra_spec` quality gate, per-node models, and a distilled
core) are load-bearing — validated end-to-end on `github-copilot/claude-opus-4.6`.

The **grounding deterministic rewrite** replaced the isolated LLM child with pure
filesystem inspection: `eza --tree --level=3` + manifest/config detection by file
existence + content reading with caps. Zero LLM tokens, millisecond execution,
fully deterministic. The original LLM grounding was expensive (a full child pi with
read-only tools exploring the codebase) and its only output was a text summary — the
same information is obtainable from the file tree + reading key config files directly.
Stack detection covers 13+ languages; configs searched up to 2-3 levels deep with
caps to prevent monorepo explosion. See `phases/brainstorm/grounding.ts`.

A **third incident** surfaced on the first live plan run. With the raw skills loaded
in the child (`--no-skills` was missing), plandraft emitted the superpowers
writing-plans header + "Execution Handoff"; and the validate gate false-rejected a
perfect plan twice — once on the project's `todoRouter` ("todo"), once on the model's
own "no TBD/TODO" self-review line — which escalated to COMPLETE and let the restored
controller LLM re-run writing-plans by hand off a dangling progress line. Fixes:
`--no-skills` on every child, file-contracts read from disk + fallback, the regex
placeholder gate removed (structural checks only), and progress stripped from context
at all times. Gotchas 21-23 trace to that run.

## Objective & status

**Objective.** Convert each superpowers skill from "inject the raw SKILL.md and let
the LLM orchestrate" into a **code-driven node machine**: the harness owns the
deterministic control (transitions, gates, persistence, feedback, context), a
*distilled* core replaces the raw skill, and the LLM is used ONLY where judgement is
needed — with its tools. Goal: same (or better) quality, far fewer tokens, and
reproducible orchestration. Migrate skill by skill: brainstorming → writing-plans → …

**Where we are:**

- **Brainstorm — validated end-to-end** on `github-copilot/claude-opus-4.6`:
  grounding (deterministic, 0 LLM tokens) → questions (adaptive, assumptions,
  0-token user gate) → spec (structural gate). Distilled core, `--no-skills`, live
  feedback, per-node models. Grounding rewritten from LLM child to pure filesystem
  inspection (`phases/brainstorm/grounding.ts`).
- **Plan — run live** on the same model: grounding / research / plandraft all
  isolated with `--no-skills` (0 raw-skill header in the output), file contracts read
  from disk + fallback. Two false-negative escalations were found and FIXED live
  (placeholder regex removed; contracts read from disk, not finalText). `bun test` +
  `tsc` green (95 tests).
- **Pending:** confirm `plan → BRANCH` on a clean re-run; migrate the later phases
  (implement / review / verify / debug / finish) to the pattern; `init.ts` still seeds
  `write`/`edit` into the brainstorm yml `tools` (harmless — gotcha 17 ignores them);
  optional hardening: clear context in `driveComplete` (gotcha 23 latent risk);
  remove `brainstorm_grounding` model config (no longer used).
