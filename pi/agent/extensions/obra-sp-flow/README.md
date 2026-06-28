# obra-sp-flow

A `pi` harness that turns a requirement into an approved design, a contract-based plan, controlled parallel execution, review, and branch close-out.

> Current status: this README describes the target resolutive flow. Implemented so far: all infra (canonical plan, phase executor, real `exec`/`llm`/`feedback` ports, session enforcement), **Phase 0 (pre-flight)**, and Phase 1 steps **`collect-tree`** + **`context-extract`** (the first LLM phase). A real run clears those and then halts at **`web-grounding`** (the next Phase 1 step — web research before the interview), which together with `brainstorm` is what to build next.

> ## ⚠️ Rule #0 — Maintenance of this README (above everything else)
>
> This README is the project's **living source of truth**. After **EVERY** change, turn, decision, or implementation, the agent MUST update — **without asking the user for confirmation** — the affected sections:
>
> - **Implementation plan** (the *Status* and *Implementation notes* columns of each step)
> - **External tools**
> - **Quirks**
> - **Gotchas**
> - **User-made decisions**
>
> Never leave the README out of sync with the code or with a decision already made. If something changed and it is not reflected here, **the turn is not complete**. This rule is applied proactively, not on request.

> ## ⚠️ Rule #1 — Language policy
>
> - **All communication with the user is in Spanish.** Chat replies, questions, explanations, and notifications go to the user in Spanish.
> - **All code, comments, and documentation are in English.** Source code, inline comments, this README, artifact field names, commit messages, and any embedded prompt text are written in English.
> - In short: talk to the human in Spanish, write the project in English.

> ## ⚠️ Rule #2 — Always give the user full context (never abbreviate)
>
> When addressing the user, **always provide full context and never rely on bare shorthand**. Codes like `Step B`, `D2`, `GATE C`, `group 1`, or a step id must be **restated in plain language in the same message** the first time they appear. Assume the user may be resuming after a break and does not have the codes memorized.
>
> - Bad: "Next is Step B; D2 and D3 are still open."
> - Good: "Next is **Step B — the minimal phase executor** (the missing loop that actually runs each phase). Two decisions are still open: **D2** (how the close-out phase ends without asking the human) and **D3** (how the review phase behaves when it finds problems with no human to ask)."

## Non-negotiable principles

1. **Deterministic pre-flight before any LLM call.**
2. **A dirty repo blocks immediately.** If there are staged, unstaged, or non-ignored untracked changes, not a single further step runs.
3. **Canonical artifacts live only in the pi session**, under `~/.pi/agent/sessions/<session>/...`.
4. **`docs/superpowers/...` is not used.** There is no export to the repo by default nor as a required output.
5. **No external skills — every reference skill becomes a per-step embedded prompt.** Each skill from the reference document is rewritten as the embedded prompt of a specific step (never loaded as an external skill), and pushed to be as deterministic as possible (deterministic control flow + command-based gates wrapping the prompt).
6. **No worktrees.** The flow works in the current checkout, optionally switching/creating a branch.
7. **Explicit decisions travel as artifacts** across all phases; no phase may depend on implicit conversational memory.
8. **Parallelism only by contract.** First a plan with per-file contracts is produced; only then are parallel agents enabled.
9. **Every gate verifies for real** with deterministic commands: lint, imports, suite, review, etc.

## Reference document (inspiration ONLY)

There is a reference document with the original step flow, diagram, and RAW skill dumps:

```text
/Users/hugoruiz/Library/Mobile Documents/iCloud~md~obsidian/Documents/ai-driven-development/agent-utilities/parallel-tdd-contract-workflow.md
```

It is the original Superpowers "Parallel-TDD with File Contracts" flow (the full step diagram in PART 1, plus the verbatim dump of every skill's `SKILL.md`, prompts, references, and scripts in PART 2).

**It is inspiration ONLY.** Its content adapts to our harness — we do NOT adapt to its content. We extract the best practices from it (TDD via contract stubs, per-file parallelism, review/gate per batch, systematic debugging) and rewrite **every one of its skills as the embedded prompt of a specific step** — never loaded as an external skill — keeping each step **as deterministic as possible** (deterministic control flow and command-based gates wrapping the prompt). They are rewritten under our own non-negotiable principles:

- no external skills (everything embedded),
- no worktrees,
- no export to `docs/superpowers/...`,
- no human gates after brainstorming approval,
- decisions travel as JSON artifacts.

The concrete skill→phase adaptation lives in [Mapping: reference document → harness phase](#mapping-reference-document--harness-phase) inside the implementation plan.

## Mandatory session

A run must be anchored to a real `pi` session. **This is the very first action of the command, before anything else.**

Strict order when `/obra-sp-flow <requirement>` runs:

1. **First, force the session to exist.** The harness emits a no-action message to the main LLM so a real conversation/turn is raised (which is what creates and persists the session file):

   ```text
   LOG:<Ejecutando obra-sp-flow>, espera instrucciones
   ```

   The expected main-LLM reply is to wait, e.g. `esperando instrucciones...`. Only the turn matters; the exact wording of the reply is not enforced.

2. **Then** create the run folder inside the now-real session, and
3. write `state.json` with the 12 steps in `pending`.

The harness must NOT fall back to `/tmp`. If `ctx.sessionManager.getSessionFile()` is still `null`/`undefined`, it forces the session (step 1) and re-resolves the real `sessionFile` before creating the run.

**Mechanism (pi API), implemented in Step D:** `src/run/ensure-session.ts` exposes `ensureSession(gate)` + `sessionGateFrom(ctx, pi)`. The gate injects the message with `pi.sendMessage({ customType, content, display: true }, { triggerTurn: true })` (falling back to `pi.sendUserMessage(...)`), then `await ctx.waitForIdle()` and re-reads `getSessionFile()`. `PiCommandApi` was extended to expose `sendMessage`/`sendUserMessage`, and the command handler now receives the `pi` object. If no session can be anchored, `startNewRun` returns `{ kind: "blocked" }` instead of writing to `/tmp`.

## Canonical run layout

Every run must be anchored to the active `pi` session:

```text
~/.pi/agent/sessions/<session>/obra-sp-flow-runs/<runId>/
├── input.md
├── state.json
├── design.md
├── plan.md
├── spec.md
├── artifacts/
│   ├── 00-preflight.json
│   ├── 01-design.json
│   ├── 02-plan-contracts.json
│   ├── 03-workspace.json
│   ├── 04-execution.json
│   ├── 05-branch-review.json
│   └── 06-close.json
└── logs/
```

The source of truth is always this run dir. Flow artifacts are never written under `docs/superpowers/...`.

## Target flow

### PHASE 0 — Deterministic pre-flight

**LLM:** no.

Before starting design, the harness inspects the workspace and decides whether the flow can continue.

Rules:

- If **there is no git**:
  - ask whether to initialize the repo;
  - if the user accepts: run `git init` and ensure the branch is `main`;
  - do not create a baseline commit;
  - work directly on `main`;
  - if the user declines: block.
- If **there is git and it is dirty**:
  - block immediately;
  - no design, plan, LLM, branches, or any other step runs.
- If **git is clean**:
  - detect the repo's real default branch (`main`, `master`, `dev`, `develop`, etc.);
  - detect the current branch;
  - ask whether to work on the current branch or create another branch;
  - if creating another branch, ask which base to create it from: the detected default branch or the current branch;
  - suggest a name based on the requirement, e.g. `feature/<requirement-slug>`;
  - never create a worktree.

Output: `artifacts/00-preflight.json`.

Expected shape example:

```json
{
  "phase": "preflight",
  "verdict": "pass",
  "blockers": [],
  "cwd": "/path/to/project",
  "runDir": "~/.pi/agent/sessions/<session>/obra-sp-flow-runs/<runId>",
  "git": {
    "present": true,
    "initializedByHarness": false,
    "status": "clean",
    "defaultBranch": "main",
    "currentBranch": "main"
  },
  "decision": {
    "mode": "new-branch",
    "branchName": "feature/add-payments-flow",
    "branchBase": "main",
    "userConfirmed": true
  }
}
```

This artifact must be read by all later phases.

### PHASE 1 — Design

**LLM:** yes, with prompts embedded in the harness.

Goal:

- understand the requirement;
- gather grounding: the repo **As-Is** (existing files involved + their current state) and **web research** (best practices + technical/business risks) so the interview starts already expert;
- explore options;
- produce an approvable design spec;
- request human approval before continuing.

Steps (in order): `collect-tree` (det tree) → `context-extract` (llm repo recon) → `web-grounding` (llm web research, BEFORE the interview) → `brainstorm` (llm interactive interview, one question at a time; emits design + discovery artifacts + As-Is) → `write-spec` (det render) → `spec-review` (llm fresh agent) → `approval-gate` (human, last gate).

Deliverables embedded in the design:

- **As-Is** — `{summary, files:[{path, role, currentState}]}` (greenfield → empty). The To-Be is the plan phase's job.
- **Discovery artifacts** — `userStory` (6-section / 3Cs incl. Gherkin acceptance criteria), `sipoc`, `userJourney`, produced by default with a justified skip via `discoveryApplicability`.
- **Web grounding** — best practices, conceptual validation, technical + business risks, references (web content treated as untrusted).

Canonical output:

- `artifacts/01-design.json`
- `design.md` (renders understanding + As-Is + discovery artifacts + approaches/recommendation + design sections)

### PHASE 2 — Plan + contracts

**LLM:** yes, with an embedded planning-and-contracts prompt.

Must:

- auto-discover the stack: language, test runner, linter, formatter, and real commands;
- define master `CONTRACTS` per file;
- for each file, declare the public interface: signatures, types, expected errors, and observable behavior;
- group work into batches:
  - `A`: stubs
  - `B`: tests
  - `D`: implementation
  - `F`: hardening
- declare in the header that the plan is `parallel-safe by contract`, and that this overrides the generic parallelism red flag once the contracts are complete.

Canonical output:

- `artifacts/02-plan-contracts.json`
- `plan.md`

### PHASE 3 — Workspace / branch

**LLM:** no.

Must apply the decision from `00-preflight.json` in the current checkout, without worktrees:

- `direct-main`: work on `main` after `git init`.
- `current-branch`: work on the clean current branch.
- `new-branch`: create/switch to the indicated branch from the chosen base.

Output: `artifacts/03-workspace.json`.

### PHASE 4 — Controlled parallel execution

**LLM:** yes, orchestrated by embedded prompts.

Each subagent must operate with instructions equivalent to:

- TDD development;
- verification before completion;
- strict respect for the file contract.

Rules:

- dispatch in waves of at most 7 agents;
- 1 file per agent;
- each agent works against its file contract;
- commit per file when done;
- review after each batch.

Batches and gates:

```text
Batch A — STUBS
  ∥ agents per file
  → commit/file
  → REVIEW(A)
  → gate: lint + imports OK

Batch B — TESTS
  ∥ agents per file
  → commit/file
  → REVIEW(B)
  → GATE C: the full suite must fail RED for the correct reason
            (e.g. NotImplementedError / equivalent stub)

Batch D — IMPL
  ∥ agents per file, TDD
  → commit/file
  → REVIEW(D)
  → GATE E: full suite + lint together

Batch F — HARDENING
  ∥ agents per file or per controlled edge case
  → commit/file
  → REVIEW(F)
```

Output: `artifacts/04-execution.json`.

#### Conditional branch — systematic debugging

**LLM:** yes, with an embedded root-cause prompt.

Triggers only if:

- the failure is not obvious or not clear;
- 2 or more fix attempts fail;
- a contract mismatch appears in `GATE E`.

Process:

```text
mini root-cause → fix → verify → return to the corresponding batch
```

It does not replace the normal flow; it is a controlled diagnostic branch.

### PHASE 5 — Branch review

**LLM:** yes, with an embedded code-review prompt.

Must review the entire resulting branch.

Process:

1. request a full review;
2. if there are findings, dispatch 1 fix subagent with the complete list;
3. verify;
4. re-review;
5. block if critical findings remain.

Output: `artifacts/05-branch-review.json`.

### PHASE 6 — Close-out

**LLM:** optional, only for summarizing; verification and actions are deterministic.

Must:

1. run the full suite as a final verification;
2. present options to the user: merge, PR, keep, discard;
3. execute the chosen option;
4. clean up the temporary branch if applicable;
5. record the final result.

Output: `artifacts/06-close.json`.

> Note: under the single human boundary (see plan), step 2 is NOT a human prompt. The action is deterministic, keyed by the preflight `decision.mode` (resolved decision D2): `new-branch` → commit + push; `direct-main` → commit to `main` (no push); `current-branch` → no commit/push, leave the working diff for the user to review.

## Artifact propagation

Each phase receives as input:

- `input.md`;
- `state.json`;
- all relevant previous artifacts;
- especially `00-preflight.json`.

Each LLM prompt must reference artifacts by path and summarize only what is needed. Git, branch, approval, and gate decisions must not be reconstructed from conversation; they are read from the persisted JSON.

## Implementation acceptance criteria

- `/obra-sp-flow <requirement>` always creates a run inside the active session.
- If there is no active session, the harness first forces session creation with a no-action message.
- No LLM call happens before `00-preflight.json`.
- A dirty repo blocks immediately and runs no later step.
- If there is no git and the user accepts, `git init` runs, `main` is ensured, and work happens there without a baseline commit.
- In existing repos the real default branch is detected.
- Worktrees are never created.
- If a branch is created, the base is asked: detected default branch or current branch.
- The git/branch choice is persisted and used in later phases.
- Design and plan are session artifacts; they are not exported to `docs/superpowers/...`.
- No external skills are loaded; prompts live embedded in the harness.
- Parallel execution does not start until per-file contracts exist.
- Every batch has a review and a verifiable gate.
- Close-out always runs a final verification before merge/PR/keep/discard.

---

## Implementation plan (resumable)

> **How to resume this session:** read this whole section, look at the **Status** column in the steps table, take the first `pending` step, follow its *Implementation notes*, and validate with its *verify*. Do not start a step without closing the open decisions that affect it.

### Golden rule: determinism first

This is the harness's core idea. Before implementing any step, ask whether the task is deterministic or ambiguous:

- **Deterministic task** (single, command-verifiable result) → **do NOT use an LLM**. Use `bash`/`git`/`eza`/stack commands.
  - E.g.: getting the folder tree at depth 5 → `eza --tree --level=5 --git-ignore`. No LLM.
  - E.g.: git status, default branch, create/switch branch, run the suite, lint → `git` / commands. No LLM.
- **Ambiguous task** (needs judgment, design, or interpretation) → **DO use an LLM**, with a harness-embedded prompt and output validated against a TypeBox contract.
  - E.g.: understanding the requirement, designing, defining per-file contracts, writing TDD code, reviewing code.
- The **control flow** and the **gates** are ALWAYS deterministic, even when an LLM generates the content. A gate never "trusts" the LLM: it verifies with real commands.
- Decisions (git/branch/approval/gates) travel as **JSON artifacts**, never via conversational memory.

### Human boundary (single)

- The human intervenes **only up to approving the brainstorming/design**.
- Before that approval: git/branch questions in pre-flight (deterministic UI, no LLM) and the brainstorming loop.
- After that approval (plan → workspace → build → fix → review → close): **100% autonomous, no human intervention**.

### Open decisions (close before coding the affected phase)

- [x] **D1** — RESOLVED (2026-06-27): "deterministic" = autonomous control flow + decisions as JSON artifacts + command-based gates; the LLM still does design/plan/build/review.
- [x] **D2** — RESOLVED (2026-06-27): close-out is **deterministic, keyed by the preflight `decision.mode`** (no prompt, no `close.action` config):
  - `new-branch` (harness-created branch) → **commit + push**, then finish.
  - `direct-main` (harness ran `git init` on a fresh repo) → **commit to `main`** (local only, no push — no remote yet), then finish.
  - `current-branch` (the user's existing branch/main) → **no commit, no push**; leave the working diff for the user to review; the harness is done.
  - Open sub-point: this implies per-file commits during execution happen only when the harness owns the history (new-branch / direct-main); on `current-branch` the work is left as an uncommitted working diff. Confirm when building Phase 4.
- [x] **D3** — RESOLVED (2026-06-27): this should rarely trigger — the cure is investing the **most capable model in the brainstorming/interview** to close every gap up front. If something genuinely blocks implementation: fix it, or build a **minimal MVP for that blocker only**, never deviating from the requirement's essence. Repair loop = **3 attempts with escalation**: 3 increasing models × 3 increasing thinking levels (attempt 1 cheap/low → attempt 3 most-capable/highest). If it still fails after attempt 3, leave the run `blocked` with a report.
- [x] **D4** — RESOLVED (2026-06-27): hybrid model. Steps are the execution/config unit; they are grouped into the 7 canonical milestones (`group` 0..6). `spec-review` is kept and runs in a fresh clean-context agent **before** the human `approval-gate`. See [Canonical step plan](#canonical-step-plan-implemented).
- [x] **D5** — RESOLVED (2026-06-27): `eza`/`rg`/`ast-grep` are **hard dependencies, always available** in the target environments. No fallback. Pre-flight (Phase 0) checks they exist and blocks with a clear message if any is missing.

### Current code snapshot

- **Present:** the `/obra-sp-flow` command + parse (help/init/continue/start); `startRun()` (run dir + `state.json`); types (`Phase`, `RunContext`, `ObraState`, `PhaseState`); TypeBox contracts (`base`, `brainstorm`, `discovery`, `grounding`, `finalize`); per-step config load/merge.
- **Step A done (2026-06-27):** `PhaseKind` now includes `orchestrated`; `src/run/phase-plan.ts` holds the canonical 12-step plan with a `group` field; `PhaseState` carries `group`; `config.yaml`/`config.example.yaml` rewritten in English with the canonical steps.
- **Step D done (2026-06-27):** `src/run/ensure-session.ts` (`ensureSession` + `sessionGateFrom`); `PiCommandApi` exposes `sendMessage`/`sendUserMessage`; the handler threads `pi`; `startNewRun` is async, forces the session first, and returns `{ kind: "blocked" }` on failure (no `/tmp` fallback). typecheck + 53 tests green.
- **Step B done (2026-06-27):** `src/run/execute.ts` (`executeRun`) is the loop; `src/run/phase-registry.ts` (empty `DEFAULT_REGISTRY`) + `src/run/ports.ts` (`placeholderPorts`, exec/llm throw until Step C); `src/paths/artifact-name.ts` rewritten group-aware; `milestone` flag added to `PhaseSeed`; wired into `startNewRun`/`continueRun`. typecheck + 65 tests green (100% coverage).
- **Phase 0 done (2026-06-27):** the first concrete phase. `src/contracts/preflight.ts` (`PreflightContract`: tools[] + git + decision, all `loose`) and `src/phases/preflight.ts` (`preflightPhase`, deterministic). It (1) probes the hard deps `bash`/`git`/`eza`/`rg`/`ast-grep` (ast-grep→`sg` fallback) and blocks on any missing; (2) on no git asks `ctx.ui.confirm` to `git init` on `main` (no baseline commit) → `direct-main`, or blocks on decline/failure; (3) blocks immediately on a dirty tree; (4) on a clean tree detects default+current branch and asks current-vs-new (+ base) via `ctx.ui.select`/`input`, suggesting `feature/<slug>`. Registered in `DEFAULT_REGISTRY`. typecheck + 114 tests green (100% coverage; 21 new preflight tests).
- **Phase 1 · `collect-tree` done (2026-06-27):** `src/phases/collect-tree.ts` (`collectTreePhase`, deterministic; contract `CollectTreeContract`). Runs `eza --tree --level=<config.collectTree.depth> --git-ignore`, clips the output to `MAX_TREE_LINES` (4000) with a truncation marker, and persists `{tool, depth, treeText, lines, truncated}` as grounding for the LLM steps. `eza` nonzero exit → `block`. Registered in `DEFAULT_REGISTRY`. typecheck + 124 tests green (100% coverage; 10 new collect-tree tests).
- **Phase 1 · `context-extract` done (2026-06-27):** `src/phases/context-extract.ts` (`contextExtractPhase`, llm; contract `ContextExtractContract`). The first LLM phase. `buildPrompt` returns an embedded READ-ONLY reconnaissance `system` prompt + a `task` injecting the requirement (`state.request`), cwd, and the `collect-tree` tree (greenfield note when absent), plus a JSON `template` kept as a valid contract example (asserted in tests). The child runs its own `rg`/`ast-grep` searches (ast-grep skill from `config.yaml`) and returns curated, structured context; the executor re-validates + retries. Registered in `DEFAULT_REGISTRY`. typecheck + 130 tests green (100% coverage; 6 new tests).
- **Step C done (2026-06-27):** the **real `RunContext` ports**. `src/run/spawn.ts` (injectable `SpawnFn`/`nodeSpawn` + `getPiInvocation`), `src/run/exec.ts` (`makeExec`: generic command spawn, native abort via the spawn `signal`, optional timeout-kill), `src/run/pi-child.ts` (`makePiRunStep` + `buildPiArgs`: headless pi child in JSON mode, adapted from the `forge` extension's spawn pattern), `src/run/llm-runner.ts` (`makeLlmRunner`: compose task + template, parse/validate, retry with correction). `ports.ts` gains `realPorts` + `uiFeedback`; `actions.ts` now uses `realPorts` (kept `placeholderPorts` for tests). `readArtifact` was already wired in Step B. typecheck + 93 tests green (100% coverage); a real pi-child integration was verified by hand (`runRound` → contract-valid `{answer, ok}` on attempt 1).
- **Phase 1 scaffolding · `web-grounding` step + As-Is (2026-06-27):** added `web-grounding` to `PHASE_PLAN` (group 1, index 3, between `context-extract` and `brainstorm`; 13 steps total, milestone numbering unchanged); new contracts `WebGroundingContract` (`grounding.ts`) + `AsIs` (`discovery.ts`, wired into `BrainstormRoundContract`/`BrainstormContract` as `asIs`); new `webGrounding.mode` config (default `deep`) + per-step `web-grounding` block (`tools: read,bash`). Not yet registered (no phase impl yet). typecheck + 132 tests green (100% coverage).
- **Missing (critical):** the remaining Phase 1 steps (`web-grounding`, `brainstorm`, `write-spec`, `spec-review`, `approval-gate`) and Phases 2–6. `DEFAULT_REGISTRY` now holds `preflight` + `collect-tree` + `context-extract`, so a real run clears those and then halts at `web-grounding` with "phase not implemented yet". Infra (executor + real ports), Phase 0, `collect-tree`, and `context-extract` are done; the web-grounding/brainstorm/spec/gate logic and Phases 2–6 remain.

### Canonical step plan (implemented)

`src/run/phase-plan.ts` — steps are the execution/config unit; each belongs to a `group` (0..6) that culminates in one numbered milestone artifact.

```text
group step             kind            milestone artifact
0     preflight        deterministic   00-preflight.json
1     collect-tree     deterministic   ┐
1     context-extract  llm             │
1     web-grounding    llm (web research)│ ← before the interview
1     brainstorm       llm             ├ 01-design.json + design.md
1     write-spec       deterministic   │
1     spec-review      llm (clean ctx) │  ← runs before the gate
1     approval-gate    gate            ┘  ← LAST human gate
2     plan-contracts   llm             02-plan-contracts.json + plan.md
3     workspace        deterministic   03-workspace.json
4     execution        orchestrated    04-execution.json
5     branch-review    llm             05-branch-review.json
6     close            deterministic   06-close.json
```

Artifact convention (implemented in Step B): the 7 numbered milestone files (`00`..`06`) live at `artifacts/NN-<milestone>.json`, each written by the step flagged `milestone: true` in `PHASE_PLAN`. Every non-milestone step writes its raw output under `artifacts/steps/NN-<id>.json` (NN = global step index). Gate steps write no artifact (they persist approval to `state.json` only). Group 1 (Design): `write-spec` is the milestone producer (`01-design.json` + `design.md`); `collect-tree`, `context-extract`, `web-grounding`, `brainstorm`, `spec-review` go under `steps/`; `approval-gate` writes nothing. `src/paths/artifact-name.ts` is now group-aware (`milestoneArtifactRel`, `stepArtifactRel`, `artifactRelForSeed`).

### Mapping: reference document → harness phase

The file `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ai-driven-development/agent-utilities/parallel-tdd-contract-workflow.md` contains the RAW dump of the Superpowers skills. **Its content adapts to this harness, not the other way around**: each prompt is rewritten as an embedded prompt, with no external skills, no worktrees, no export to `docs/superpowers/...`, and with the human gates after brainstorming removed.

| Reference-document skill | Target phase | How it adapts |
| --- | --- | --- |
| `brainstorming` | Phase 1 | Keep the HARD-GATE of human approval (it is the last gate). Drop the browser companion; the visual companion is **ASCII wireframes in the terminal** for now. Spec → `design.md` in the run dir, not `docs/superpowers/...`. |
| `writing-plans` (+ contract inject) | Phase 2 | Auto-discover the stack (deterministic part via bash). Per-file contracts (LLM). `parallel-safe by contract` header. No human approval. |
| `using-git-worktrees` | Phase 0/3 | **Drop worktrees.** Replace with pre-flight (Phase 0) + workspace branch on the current checkout (Phase 3). |
| `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `dispatching-parallel-agents` | Phase 4 | Deterministic orchestration (waves ≤7, 1 file/agent, commit/file, gates C/E). Embedded subagent prompts. Autonomous. |
| `systematic-debugging` | Phase 4 (conditional branch) | Triggers only on deterministic rules (non-obvious failure / 2+ fixes / GATE E mismatch). |
| `requesting-code-review`, `receiving-code-review` | Phase 5 | Autonomous review + fix subagent + re-review. D3 escalation (3 attempts × 3 models × 3 thinking levels) on block. |
| `finishing-a-development-branch` | Phase 6 | Final suite (det) + deterministic action by preflight `decision.mode` (D2, no asking). |

### Implementation steps

Type: `infra` (harness plumbing) · `det` (deterministic, no LLM) · `llm` · `gate` (human) · `orq` (orchestrated: deterministic control + LLM subagents).
Status: `pending` · `in progress` · `done` · `blocked`.

| # | Step | Type | Status | Comments | Implementation notes |
| --- | --- | --- | --- | --- | --- |
| A | Canonical PHASE_PLAN (7 milestones / 12 steps) | infra | **done** | replaces the lite flow; base for everything else | DONE: rewrote `src/run/phase-plan.ts` with 12 steps + `group`; added `"orchestrated"` to `PhaseKind`; `PhaseState` carries `group`; config rewritten in English. **verify (met):** `startRun` → `state.json` with 12 phases, `currentPhaseId="preflight"`; typecheck + 46 tests green. |
| B | Minimal phase executor | infra | **done** | the missing loop; now built | DONE (2026-06-27): `src/run/execute.ts` (`executeRun`) iterates the plan, builds `RunContext`, runs `run()` (det/gate/orq) or `buildPrompt()`+`llm.runRound()` (llm), **re-validates every payload against the step contract** (the loop never trusts the LLM), writes artifacts atomically and stamps `ArtifactMeta` under `_meta`. Group-aware naming (B-1): milestones at `artifacts/NN-<milestone>.json`, other steps at `artifacts/steps/NN-<id>.json`, gates write none. Stop conditions: not-implemented/throw/contract-invalid/verdict-block (`blocked`/`failed`); a gate without approval pauses to `awaiting-approval` and is **re-evaluated on resume** (B-3). New `phase-registry.ts` (empty `DEFAULT_REGISTRY`, B-2) + `ports.ts` (`placeholderPorts`, exec/llm throw until Step C, B-4). Wired into `startNewRun`/`continueRun`. **verify (met):** 11 `executeRun` tests (det / milestone / llm / gate pause+resume / readArtifact / shouldRun-skip / placeholder-ports / throw / contract-invalid / verdict-block / not-implemented) + `notifyOutcome`; typecheck + 65 tests green at 100% coverage. |
| C | Real `RunContext` ports | infra | **done** | exec / llm / feedback / readArtifact | DONE (2026-06-27): `src/run/spawn.ts` (`SpawnFn`/`nodeSpawn`/`getPiInvocation`), `src/run/exec.ts` (`makeExec`), `src/run/pi-child.ts` (`makePiRunStep`/`buildPiArgs`), `src/run/llm-runner.ts` (`makeLlmRunner`). `exec`: generic spawn (abort via spawn `signal`, optional timeout SIGKILL). `llm`: headless `pi --mode json -p --no-session [--model M[:thinking]] [--tools T] [--skill S]… [--append-system-prompt FILE] "Task: …"`, JSONL parsed line-by-line, `finalText = stopText \|\| lastText`, JSON extracted + re-validated against the contract with `llmRetries` corrective retries. `feedback`: `uiFeedback` → `ctx.ui.setStatus`. `readArtifact` already wired (Step B). `realPorts` injected via `actions.ts`; `placeholderPorts` kept for tests. **verify (met):** typecheck + 93 tests green (100% coverage); manual real-pi integration returned a contract-valid artifact on attempt 1. |
| D | Session enforcement (runs FIRST) | infra | **done** | the command's very first action, before `startRun` | DONE: `src/run/ensure-session.ts` (`ensureSession`, `sessionGateFrom`, `SESSION_FORCE_MESSAGE`). Forces the session via `pi.sendMessage(…,{triggerTurn:true})`/`sendUserMessage` + `ctx.waitForIdle()`, re-reads `getSessionFile()`, else `{kind:"blocked"}` — never `/tmp`. `PiCommandApi` extended; handler threads `pi`; `startNewRun` is async. **verify (met):** 5 `ensure-session` tests + 2 `actions` tests (blocked path + happy path); typecheck + 53 tests green. |
| 0 | Phase 0 — Pre-flight | det | **done** | no LLM; asks git/branch via `ctx.ui` | DONE (2026-06-27): `src/phases/preflight.ts` (`preflightPhase`) + `src/contracts/preflight.ts` (`PreflightContract`). Tool probe (D5) bash/git/eza/rg/ast-grep (→`sg` fallback) blocks on missing. Git: dirty → immediate `block`; no git → `ctx.ui.confirm` to `git init`+ensure `main` (no baseline commit) → `direct-main`, decline/fail → block; clean → detect default (origin/HEAD → main/master/develop/dev/trunk → current) + current branch, `ctx.ui.select` current-vs-new, `ctx.ui.input` name (suggest `feature/<slug>`), base via select when default≠current. Never a worktree. Registered in `DEFAULT_REGISTRY`. **Output:** `artifacts/00-preflight.json`. **verify (met):** 21 tests (missing tool, no-git consent/decline/init-fail, dirty, current/new branch, base prompt, cancels) + contract validation; typecheck + 114 tests green (100% coverage). |
| 1 | Phase 1 — Design / Brainstorm | llm + gate | **in progress** | **last human gate** | Sub-steps in order: `collect-tree` (det) **DONE** (`src/phases/collect-tree.ts`); `context-extract` (llm, rg/ast-grep) **DONE** (`src/phases/context-extract.ts`, embedded READ-ONLY recon prompt + valid JSON template). Remaining: `web-grounding` (llm, web research BEFORE the interview — ddg/Brave via the DataImpulse proxy, `tools: read,bash`, results untrusted; emits `WebGroundingContract`), `brainstorm` (llm, one question at a time — **architecture decided: subprocess-per-round + harness-mediated `ctx.ui` loop, Option A**; the configured model rides on the child's `--model X:thinking`, principal model untouched; also emits the As-Is + discovery artifacts), `write-spec` (det, render `design.md`), `spec-review` (llm, **fresh clean-context agent**, before the gate), `approval-gate` (human). Adapt the `brainstorming` prompt (no browser). **Output:** `artifacts/01-design.json` + `design.md`. **verify:** without approval it does not advance; with approval `granted` is set in state. |
| 2 | Phase 2 — Plan + contracts | llm | pending | autonomous from here on | Auto-discover stack (bash: package.json/lockfiles/test/lint config). Master per-file contracts (signatures/types/errors/behavior). Batches A/B/D/F. `parallel-safe by contract` header. Adapt `writing-plans`. **Output:** `artifacts/02-plan-contracts.json` + `plan.md`. **verify:** contract requires non-empty `CONTRACTS` and real stack commands. |
| 3 | Phase 3 — Workspace / branch | det | pending | applies `00-preflight` decision | Pure `git` per `decision.mode`: `direct-main` / `current-branch` / `new-branch` (from chosen base). Never a worktree. **Output:** `artifacts/03-workspace.json`. **verify:** resulting branch == persisted decision. |
| 4 | Phase 4 — Parallel execution | orq | pending | real C and E gates | Waves ≤7, 1 file/agent, commit/file. Batch A stubs→REVIEW(A)→gate lint+imports; B tests→REVIEW(B)→GATE C (suite RED for the right reason); D impl TDD→REVIEW(D)→GATE E (suite+lint); F hardening. Conditional `systematic-debugging` branch by deterministic rules. Embedded subagent prompts. **Output:** `artifacts/04-execution.json`. **verify:** gates verify with commands; no advance with a red suite at GATE E. |
| 5 | Phase 5 — Branch review | llm | pending | D3 escalation policy | Full review → if findings, 1 fix subagent with the list → verify → re-review. No human. Repair loop = **3 attempts, escalating** (3 models × 3 thinking levels). A genuine blocker → fix or minimal MVP for that blocker only (never deviate from the requirement). After attempt 3 still failing → run `blocked` + report. Adapt `requesting/receiving-code-review`. **Output:** `artifacts/05-branch-review.json`. **verify:** persistent critical findings after 3 escalating attempts leave the run `blocked`. |
| 6 | Phase 6 — Close-out | det | pending | mode-driven (D2) | Run the full suite (final verification). Then act by preflight `decision.mode`: `new-branch` → commit + push + finish; `direct-main` → commit to `main` (no push) + finish; `current-branch` → no commit/push, leave working diff for user review. Record the result. LLM optional only for summary. **Output:** `artifacts/06-close.json`. **verify:** does not close if the final suite fails; the git action matches `decision.mode`. |

### Recommended order

All infra is done: `A` (canonical plan), `B` (executor), `C` (real `exec`/`llm`/`feedback` ports), `D` (session enforcement). **Phase 0 (pre-flight) and Phase 1's `collect-tree` + `context-extract` are done and registered.** Next is the rest of Phase 1 — Design, then Phases `2 → 3 → 4 → 5 → 6`. The real `RunContext` ports are wired, so each phase can be built with its embedded prompt against `rc.exec`/`rc.llm`/`rc.feedback`/`rc.readArtifact`. Order: `web-grounding` (LLM, web research before the interview; child uses `bash` for ddg/Brave via the DataImpulse proxy; results untrusted; **best-effort** — degrades to `webAvailable:false` if the web is unreachable) → `brainstorm` (LLM, **interactive human loop**, one question at a time — the heart of the flow; subprocess-per-round + `ctx.ui` loop, Option A; pin the most capable model; ASCII wireframes, no browser; emits design + As-Is + discovery artifacts) → `write-spec` (det, render `design.md` + `01-design.json`) → `spec-review` (LLM, fresh clean-context agent) → the human `approval-gate`. Loop mechanics (#3a) + executor tweak (#3a-bis) are decided; next is **decision #3b** (the embedded prompts for `web-grounding` + `brainstorm`).

---

## External tools

> Keep this section up to date (Rule #0). If a phase starts using a new binary, add it here.

### Harness-fixed (always assumed, deterministic)

| Tool | Purpose | Phase(s) |
| --- | --- | --- |
| **bash** | shell/exec for everything deterministic | all |
| **git** | status, clean/dirty, default branch, current branch, init, checkout/create branch, commit per file, merge | 0, 3, 4, 6 |
| **eza** | folder tree `eza --tree --level=5 --git-ignore` | 1 (collect-tree) |
| **rg** (ripgrep) | text-based context search | 1 (context-extract) |
| **ast-grep** (`ast-grep`/`sg`) | structural code search (skill referenced in `config.yaml`) | 1 (context-extract) |
| **pi** (child process) | runner for the LLM steps (design/plan/build/review) | 1, 2, 4, 5 |
| **ddg** (DuckDuckGo CLI) | web search through the DataImpulse proxy (`--backend lite --user-agent chrome`) | 1 (web-grounding) |
| **curl** | web requests through the DataImpulse proxy (Brave API / Brave SERP scrape), real browser UA | 1 (web-grounding) |

### Project-discovered (NOT fixed — auto-discovered in Phase 2)

Not hardcoded; resolved per project by reading `package.json`, lockfiles, and configs. They feed the real gates (GATE C, GATE E) and the final close-out verification. They are deterministic (command + exit code); only the concrete command is variable.

- **test runner** — `bun test` / `jest` / `vitest` / `pytest` / `go test` / …
- **linter** — `eslint` / `ruff` / `golangci-lint` / …
- **formatter** — `prettier` / `biome` / `gofmt` / …
- **build/typecheck** — `tsc` / `bun build` / …

### Conditional / optional

- **git remote / upstream** — `new-branch` close does `git push`, which needs a configured remote + upstream. No remote → push step is skipped/blocked (see Gotchas).
- ~~**gh** (GitHub CLI)~~ — not used. The PR close path was dropped by resolved decision D2 (close is mode-driven: commit/push/leave, never PR).
- **DataImpulse proxy** (`DI_LOGIN`/`DI_SEC`/`DI_HOST`/`DI_PORT` env vars) — carries web-grounding's `ddg`/`curl` requests. Missing → web-grounding degrades to `webAvailable:false` (best-effort, never blocks the run).
- **`BRAVE_SEARCH_API_KEY`** (env) — optional. Set → web-grounding `deep` mode uses the Brave Search API + ddg; unset → ddg + Brave frontend (`search.brave.com`) HTML scrape.

### Deterministic availability check (Phase 0)

Pre-flight verifies that `bash`/`git`/`eza`/`rg`/`ast-grep` exist and records versions in `00-preflight.json`. A missing binary → `block` with a clear message (D5: these are hard dependencies, no fallback). No LLM. **Implemented** in `src/phases/preflight.ts` (`probeTool`/`checkTools`); `ast-grep` falls back to the `sg` binary. `ddg`/`curl`/the DataImpulse proxy are a **soft probe** (recorded, NOT blocking) because web-grounding is best-effort — *planned*, not yet implemented.

---

## Quirks

> By-design behaviors worth remembering (these are not bugs).

- Canonical artifacts live **only** in the pi session (`~/.pi/agent/sessions/<session>/obra-sp-flow-runs/<runId>/`). Never in the repo nor under `docs/superpowers/...`.
- **No worktrees** on purpose, even though the reference document uses them. The flow works on the current checkout.
- **No external skills are loaded.** All prompts live embedded in the harness.
- The command's **first** action forces session creation with the no-action message `LOG:<Ejecutando obra-sp-flow>, espera instrucciones` (the main LLM replies `esperando instrucciones...`), instead of falling back to `/tmp`. The run dir + `state.json` are created only after the session is real.
- In `config.yaml`, an empty `model` on a step or in `defaults` ⇒ the pi child inherits the session's default model.
- The ast-grep binary may be invoked as `ast-grep` or `sg`; `sg` collides with other commands on some systems. Phase 0's `probeTool` tries `ast-grep` first and only falls back to `sg`, recording which `binary` actually answered.
- **Phase 0 git/branch questions go through the deterministic UI port** (`ctx.ui.confirm` for git-init consent, `ctx.ui.select` for current-vs-new + base, `ctx.ui.input` for the branch name) — never an LLM. A cancelled select/confirm becomes a `block` with `decision.mode = "none"`.
- **Default-branch detection is a heuristic** (no network): `git symbolic-ref refs/remotes/origin/HEAD` first, then probe `main`/`master`/`develop`/`dev`/`trunk` for a local ref, finally fall back to the current branch.
- Phase 0 only *decides* the branch (persisted to `decision`); it never creates/switches branches — that is Phase 3's job. The one exception is `git init` (+ `symbolic-ref HEAD refs/heads/main`) on a fresh repo, which Phase 0 performs so the rest of the flow has a repo to work in.
- The reference file (`parallel-tdd-contract-workflow.md`) is at an iCloud/Obsidian path with spaces and `~`; always quote it.
- Decisions travel as JSON artifacts; no phase may reconstruct git/branch/approval/gates from the conversation.
- Every artifact carries a `_meta` block (phase id, index, kind, attempt, timing, model) stamped by the executor — **not** produced by the LLM. Contracts use `loose(...)` so the surplus `_meta` never breaks re-validation.
- Per-step raw outputs live under `artifacts/steps/`; only the 7 canonical milestones sit at the `artifacts/` top level.
- **LLM steps run as an isolated, headless pi child** (`pi --mode json -p --no-session …`), one process per round. The child binary is resolved by `getPiInvocation` — it reuses the **current** pi script/runtime (`process.argv[1]` + `process.execPath`), falling back to `pi` on PATH only when it cannot be resolved. The spawn pattern is adapted from the sibling `forge` extension (`src/pi-spawn.ts`).
- The step **system prompt is written to a temp file** (mode `0600`) and passed via `--append-system-prompt`; the temp dir is removed in `finally` (`fs.rmSync(..., { recursive: true, force: true })`).
- **`thinkingLevel` is folded into the model pattern** (`provider/id:thinking`) when a model is set; with no model it falls back to a separate `--thinking`. An empty model lets the child use its own default (note: a `--no-session` child has no session default to inherit — it uses the global/provider default).
- The child's **JSONL event stream is parsed line-by-line**; the artifact text is the final assistant message, preferring the one whose `stopReason === "stop"` (`finalText = stopText || lastText`). A trailing partial line is flushed on `close`.
- **`LlmRunner.runRound` never trusts the child:** it extracts JSON (`parseJsonLoose`), validates against the contract, and on a bad reply retries with an explicit correction up to `llmRetries` extra attempts. The executor then re-validates the returned payload again.

---

## Gotchas

> Traps that will break the flow if you forget them.

- **A dirty repo blocks EVERYTHING immediately** (staged/unstaged/non-ignored untracked). No LLM, no design, not a single phase runs.
- **No LLM call before `00-preflight.json`.** Pre-flight is the deterministic gate.
- **`preflight` + `collect-tree` + `context-extract` are registered; the rest of Phase 1 and Phases 2–6 are not yet.** `DEFAULT_REGISTRY` holds those three, so a real run clears them and then halts at `web-grounding` with "phase not implemented yet" until the remaining phases are built. Production uses `realPorts` (real `exec`/`llm`/`feedback`); `placeholderPorts` (which throw on `exec`/`llm`) survive only for tests of phases that never reach them. LLM phases like `context-extract` are unit-tested through `buildPrompt` alone (no `llm` call), so they stay deterministic to test.
- **Gates write no artifact** — they persist approval to `state.json` only. A gate without approval pauses the run to `awaiting-approval` and is re-run on resume (its `PhaseState` is reset to `pending`, never left `passed`).
- `eza`/`rg`/`ast-grep` are **hard dependencies (D5 resolved): assumed always available**; pre-flight blocks if any is missing (no fallback).
- `new-branch` close runs `git push`; with no remote/upstream configured, the push fails. Phase 6 must handle "no remote" gracefully (skip push, record it), not crash.
- Paths with spaces (iCloud) without quotes → broken commands.
- **ALL web-grounding results are untrusted** (prompt-injection). The child must never act on instructions embedded in web content (fake `<system>` tags, "ignore previous", "run this command/URL", "save to memory", multilingual variants) — it only summarizes, cites, and records attempts in `injectionFlags`. No native web tool (`webfetch`/`web_search`); only `ddg`/`curl` through the DataImpulse proxy.
- **Web-grounding is best-effort, NOT a gate.** No network/proxy → `webAvailable:false` + empty findings + `verdict:"pass"`; it must never block the run over a flaky network. The current date is injected by the harness (`now()`), the child does not run `date`.

---

## User-made decisions

> Firm decisions by the user. Distinct from the *Open decisions* (D1–D5), which are my proposals awaiting confirmation. Keep up to date (Rule #0).

| Date | Decision | Impact |
| --- | --- | --- |
| 2026-06-27 | **Determinism first.** Ambiguous task → LLM; deterministic task → NO LLM (e.g. folder tree at depth 5 → `eza`, not LLM). | Golden rule that classifies every step in the plan. |
| 2026-06-27 | **Single human boundary:** the human intervenes only up to approving the brainstorming/design. After that (plan → build → fix → review → close) it is 100% autonomous. | Forces autonomous close and review (origin of D2/D3). |
| 2026-06-27 | **The reference document adapts to the harness, not the other way around.** `parallel-tdd-contract-workflow.md` is rewritten as embedded prompts; it is inspiration only. | No external skills, no worktrees, no export to `docs/superpowers/...`. |
| 2026-06-27 | **The README carries the resumable implementation plan at the end**, with *Comments* and *Implementation notes* columns. | Allows continuing step by step across sessions. |
| 2026-06-27 | **README maintenance Rule #0.** Keep Plan, External tools, Quirks, Gotchas, and Decisions always up to date after every change/turn/decision, without asking for confirmation. | The README is the living source of truth; updating is part of every turn. |
| 2026-06-27 | **Language policy (Rule #1).** All communication with the user is in Spanish; all code, comments, and documentation are in English. | The README and source are in English; chat replies stay in Spanish. |
| 2026-06-27 | **D1 confirmed:** "deterministic" = autonomous control flow + decisions as JSON + command-based gates. | Closes open decision D1; LLM still does design/plan/build/review. |
| 2026-06-27 | **D4 resolved (hybrid):** steps are the execution/config unit, grouped into 7 milestones (`group` 0..6). | Drives the canonical 12-step `PHASE_PLAN` (Step A). |
| 2026-06-27 | **`spec-review` kept**, run by a separate fresh clean-context agent **before** the human `approval-gate`. | Adds `write-spec` → `spec-review` → `approval-gate` ordering in Phase 1. |
| 2026-06-27 | **Communication rule (Rule #2):** always give the user full context, never use bare abbreviations/codes without restating their meaning. | Replies must expand `Step B`, `D2`, `GATE C`, etc. in plain language. |
| 2026-06-27 | **Session-first ordering:** the command's first action is to emit `LOG:<Ejecutando obra-sp-flow>, espera instrucciones` to force the session, THEN create the run dir + `state.json`. | Corrects the order; Step D runs at command entry, before `startRun`. |
| 2026-06-27 | **D2 resolved (mode-driven close):** `new-branch` → commit+push; `direct-main` → commit to main (no push); `current-branch` → no commit/push, user reviews. | Replaces the `close.action` config idea; Phase 6 is fully deterministic. |
| 2026-06-27 | **D3 resolved (escalation):** repair loop of 3 attempts × 3 models × 3 thinking levels; genuine blocker → fix or minimal MVP for that blocker only; then `blocked` if still failing. | Plus: use the most capable model in brainstorming to avoid reaching this. |
| 2026-06-27 | **Most capable model in brainstorming/interview** to close all gaps up front. | Brainstorm step (Phase 1) should pin the best available model. |
| 2026-06-27 | **Step B executor decisions (B-1..B-5):** group-aware artifact layout (milestones at `NN-<milestone>.json`, other steps under `steps/`, gates none); empty registry whose missing phases `block` honestly; gate without approval → `awaiting-approval`, re-evaluated on resume; ports injected (exec/llm placeholders until Step C); LLM payload re-validated against the contract with `llmRetries`, artifact-then-state atomic write order. | Shapes `execute.ts`, `phase-registry.ts`, `ports.ts`, `artifact-name.ts`. |
| 2026-06-27 | **D5 resolved:** `eza`/`rg`/`ast-grep` are hard dependencies, always available; no fallback (pre-flight blocks if missing). | Closes D5; removes fallback branches from Phases 0/1. |
| 2026-06-27 | **Brainstorming visual companion = ASCII wireframes** in the terminal for now (no browser/HTML companion). | Phase 1 brainstorm renders wireframes as ASCII, not a web server. |
| 2026-06-27 | **Every reference-document skill is converted into a per-step embedded prompt** (never imported as an external skill) and made as deterministic as possible (deterministic control flow + command gates around it). | Reinforces principle #5; governs how each phase prompt is written. |
| 2026-06-27 | **Phase 1 · `context-extract` implemented (first LLM phase).** Embedded READ-ONLY reconnaissance prompt; injects requirement + cwd + `collect-tree` tree; child runs its own `rg`/`ast-grep` (ast-grep skill); JSON template kept as a valid `ContextExtractContract` example (asserted). Registered in `DEFAULT_REGISTRY`. | Establishes the LLM-phase pattern (`buildPrompt`); a real run now stops at `web-grounding`. |
| 2026-06-27 | **Phase 1 · `collect-tree` implemented.** Deterministic `eza --tree --level=<depth> --git-ignore`, output clipped to `MAX_TREE_LINES` (4000) with a truncation marker; nonzero `eza` exit → `block`. Registered in `DEFAULT_REGISTRY`. | Grounding tree ready for the LLM steps; a real run now stops at `context-extract`. |
| 2026-06-27 | **Phase 0 implemented (pre-flight).** Registered `preflight` in `DEFAULT_REGISTRY`. Tool probe order bash/git/eza/rg/ast-grep with `ast-grep`→`sg` fallback; default-branch heuristic origin/HEAD→common-names→current; git/branch decisions via `ctx.ui` (`confirm`/`select`/`input`), persisted to `decision`; Phase 0 runs `git init` on a fresh repo but defers branch create/switch to Phase 3. | First concrete phase done; a real run now clears Phase 0 and stops at `collect-tree` (Phase 1). |
| 2026-06-27 | **Step C ports wired (C-1..C-4):** C-1 real `exec` (generic spawn, native abort via the spawn `signal`, optional timeout SIGKILL); C-2 real `llm` = headless pi child reusing the `forge` spawn pattern (temp-file system prompt, `--model M[:thinking]`, `--skill`, JSONL parse, `finalText = stop\|\|last`) wrapped by `makeLlmRunner` (corrective retries + contract re-validation); C-3 `feedback` → TUI status line (`ctx.ui.setStatus`); C-4 `readArtifact` already wired in Step B. `placeholderPorts` kept for tests; `actions.ts` now uses `realPorts`. The pi binary is resolved via `getPiInvocation` (reuse current pi runtime, else `pi`). | Replaces `placeholderPorts` in production; unblocks building Phases 0–6. |
| 2026-06-27 | **Discovery deliverables in brainstorm.** The brainstorm must produce, beyond `understanding` + `design`, the three discovery artifacts already modeled in `src/contracts/discovery.ts` and already wired into `BrainstormContract`: `userStory` (6-section / 3Cs: `title`, `narrative{asA,iWant,soThat}`, `businessRules`, Gherkin `acceptanceCriteria{scenario,given,when,then}`, `definitionOfDone`, `uxUiAndData{notes,links,apiContracts}`), `sipoc`, `userJourney`. **Policy (ii):** produce all three by default with a *justified skip* — `discoveryApplicability` records `{applies,reason}` per artifact and the artifact may be `false` when it genuinely does not fit (bias toward producing; no hollow filler). `write-spec` renders `design.md` embedding ALL of these (understanding + the discovery artifacts + approaches/recommendation + design sections). | No new contract needed (already in `discovery.ts`); the brainstorm prompt must elicit them and `design.md` must render them. |
| 2026-06-27 | **Brainstorm loop shape (2a/2b/2c accepted).** 2a — rendering driven by the `Question` contract: `options` non-empty → `ctx.ui.select` (with an "✏️ Other (write)" fallthrough to `ctx.ui.input` when `allowFreeText`); no `options` → `ctx.ui.input`; `visual`/`asciiWireframe` → print the ASCII wireframe before asking; one question per round. 2b — loop stops when the child returns `status:"ready"`, capped by `brainstorm.maxRounds` (0 = unlimited; on cap force a final "finalize now" round), plus a per-question "✅ I'm ready, propose the design" user escape. 2c — `brainstorm` is a pure interview: it emits the `design` object and defers ALL human approval to `write-spec` → `spec-review` → `approval-gate` (no in-loop section-by-section approval). | Shapes the brainstorm `run()` loop + the per-round prompt; keeps the single human gate intact. |
| 2026-06-27 | **Brainstorm architecture = subprocess-per-round + harness-mediated UI (Option A).** The interactive `brainstorm` step is NOT one long-lived child (a headless `pi -p` child is non-interactive and cannot pause to ask the user). Instead the harness owns the loop: each round spawns a fresh headless child with the step's configured model (`--model X:thinking`) that returns JSON (next single question OR ready+design); the harness asks the user via the `ctx.ui` ports and feeds the answer into the next round's `qaHistory`. | Resolves "how to use the configured brainstorm model without changing the principal model": the child carries `--model X:thinking`, the session's main model is never touched. Rejected Option B (drive the main session via `pi.setModel`/`sendUserMessage`) as it pollutes the main context, mutates global session state, and breaks the JSON-artifact / no-conversational-memory principles. |
| 2026-06-27 | **Brainstorm loop mechanics (#3a) + executor tweak (#3a-bis).** #3a: each round returns the FULL evolving state (the child is a fresh subprocess each round, rebuilt from requirement + `context-extract` + `qaHistory`) plus either `status:"needs-answers"` + exactly ONE question or `status:"ready"`; the harness owns `qaHistory` (child receives it read-only), asks `questions[0]`, appends `{round,questionId,question,answer}`, and on close stamps its authoritative `qaHistory`; `terminatedBy ∈ {ready, max-rounds, user-escape}` (the last two trigger one final "finalize now" round); final `BrainstormContract` = last snapshot + `{rounds,terminatedBy,qaHistory,verdict}`. #3a-bis: `brainstorm` declares `kind:"llm"`, `contract: BrainstormContract`, and defines `run()`; `runPhase` (in `src/run/execute.ts`) is tweaked to **prefer `run()` when a phase defines it** (even for `llm` kind), `buildPrompt` stays the single-round path; inside `run()` the brainstorm calls `rc.llm.runRound(... contract: BrainstormRoundContract ...)` per round + `rc.ctx.ui` for questions. | Defines the brainstorm loop + the one infra change to the executor; does not affect `preflight`/`collect-tree`/`context-extract`. |
| 2026-06-27 | **As-Is is a design-phase deliverable.** The brainstorm consolidates an `asIs` (`{summary, files:[{path, role, currentState}]}`, greenfield → empty) from the `context-extract` grounding; `write-spec` renders it into `design.md`. Strictly descriptive of the CURRENT state — the To-Be (target files/changes) is the plan phase's (group 2) job. Contract `AsIs` added to `discovery.ts`, wired into `BrainstormRoundContract`/`BrainstormContract`. | Sets up the plan phase to produce the To-Be from a recorded As-Is. |
| 2026-06-27 | **Web-grounding step BEFORE the interview (new step in PHASE_PLAN).** New `web-grounding` (llm) inserted in group 1 between `context-extract` and `brainstorm` (13 steps total; milestone numbering unchanged). The child researches the web (ddg/Brave via the DataImpulse proxy; `tools: read,bash`; no native web tool) to ground best practices + conceptual validation + technical/business risks, so the interview starts expert. Method extracted deterministically from the user's Web Search skill (proxy + UA + backend-selection rule + harness-injected date); ALL results untrusted (prompt-injection — summarize/cite/flag only). **Best-effort** (`webAvailable:false` if unreachable; never blocks). Mode `deep` by default (Brave API if `BRAVE_SEARCH_API_KEY`, else ddg + Brave scrape). Contract `WebGroundingContract` + `webGrounding.mode` config added. | Brainstorm consumes repo As-Is + web grounding → "already expert" before asking the user; adds ddg/curl/proxy to External tools. |
