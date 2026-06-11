# obra-sp-flow

One command runs the full **superpowers** pipeline end-to-end, from a single idea:

```
brainstorm → plan → branch → implement → review → verify → (debug loop) → finish
```

The extension owns **orchestration only**. The "how" of each step lives in the
superpowers `SKILL.md` files (loaded fresh from disk). Each non-interactive step
runs as an isolated child `pi` process; the controller session only drives the
state machine.

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
  brainstorm.ts   interactive (runs IN the controller session)
  plan.ts         autonomous + Gemini research gate
  branch.ts       deterministic git branch (idempotent)
  implement.ts    parallel-by-DAG, 1 agent = 1 file
  review.ts       consolidated review + fix
  verify.ts       deterministic checks (hybrid command resolution)
  debug.ts        systematic-debugging circuit (budgeted)
  finish.ts       pr | merge | keep

tools/index.ts  obra_spec — the brainstorm phase's "commit the spec" tool.
commands/init.ts  the /obra-sp-flow-init scaffolder.

lib/
  spawn-pi.ts      runs an isolated child pi (json mode, --no-session) + TIMEOUT
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
  skill-loader.ts  reads SKILL.md fresh + autonomous wrapper
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
| brainstorm | **yes** | minimax/MiniMax-M3 | spec md + resolves ALL ambiguity |
| plan | no | claude-opus-4-8 | plan md + file contracts (research-gated) |
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

## Configuration

Defaults live in `config.yml`. A **trusted** project may override any of them in
`{project}/.pi/obra-sp-flow/obra-sp-flow.yml` (deep-merged; project wins).
Scalars support `"$ENV_VAR"` and `"$ENV_VAR:fallback"`.

Key sections:
- `phases.<phase>` — `provider` / `model` (must exist in pi enabledModels),
  `thinking`, `rules` (lines injected into that phase's prompt), `tools`
  (allowlist override; empty = code default from `lib/tools.ts`).
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

8. **Brainstorm is the ONLY interactive phase.** Every other phase is an isolated
   subagent with no human (the autonomous wrapper forbids `ask_user_question`).
   All ambiguity must be resolved during brainstorm. Brainstorm runs IN the
   controller session and commits via the `obra_spec` tool; the `agent_end` hook
   advances only when `scratch.specReady` is set.

9. **Context windowing.** While a flow is active, the `context` hook trims the
   controller's history to the last phase marker (`filterContext`) so the
   interactive brainstorm doesn't bloat later turns.

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
    degrades to `""` (subagents still get the autonomous wrapper).

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
