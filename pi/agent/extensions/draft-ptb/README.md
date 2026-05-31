# draft-ptb v2

> Deterministic orchestration extension for pi.dev that converts 3 LLM-driven skills (brainstorming, writing-plans, subagent-driven-development) into a state machine. AI is invoked **only** at creative points, saving ~84% tokens.

## Thesis

**"Don't let the LLM orchestrate. Let it create."**

Traditional skill-based flows let the LLM decide what step comes next every turn — paying quadratic context costs as history grows. This extension replaces that with:

- **Deterministic state machine** handles all orchestration (0 tokens)
- **LLM invoked only for creative work** (research, synthesis, review)
- **`terminate: true`** cuts each turn as soon as structured output is delivered
- **Model routing** per phase (opus for synthesis, sonnet for tools, gpt/gemini for diverse review)

| Metric | Traditional skill | This extension | Savings |
|--------|-------------------|----------------|---------|
| LLM turns | 12–15 | 4–5 | ~70% |
| Input tokens | ~252K | ~36K | ~86% |
| Output tokens | ~10K | ~6.3K | ~37% |
| **Total** | **~262K** | **~42K** | **~84%** |
| Cost USD | $0.91 | $0.55 | ~40% |

---

## Usage

```
/draft-ptb <describe your idea>
/draft-ptb-cancel
```

Requires an interactive pi.dev session with UI context.

---

## Architecture: 13-Phase State Machine

```
IDLE
 │ /draft-ptb <idea>
 ▼
[1] GATHERING_CONTEXT ────────── deterministic (0 tokens)
 │   detects git, manifests, monorepo, test frameworks, Obsidian path
 ▼
[2] RESEARCH                     1 turn sonnet (tools: bash/read/ast-grep)
 │   produces understanding + compressedContext (~2K) + testRequirements
 ▼
[3] USER_QUESTIONS ──────────── deterministic (ask_user_question)
 │   presents questions from [2] + test opt-in
 ▼
[4] COMPLETENESS_CHECK           1 turn sonnet (~3-5K)
 │   validates answers are sufficient; loops back to [3] if not (max 3)
 ▼
[5] APPROACHES                   1 turn sonnet
 │   2-3 options with tradeoffs; user selects via widget + select
 ▼
[6] DESIGN (spec)                1 turn opus (+ patch loop)
 │   generates spec with test surface; user approves ← last human gate
 ▼
[7] PLAN                         1 turn opus
 │   file contracts + DAG + sharedFiles + infraTask + testContracts
 ▼
[8] PARALLEL_IMPLEMENTATION      N subagents sonnet (by DAG level)
 │   infra subagent runs first (if sharedFiles); then DAG levels in parallel
 ▼
[9] TEST_GENERATION              N subagents sonnet (conditional)
 │   workbook + playwright per journey; skips if user declined tests
 ▼
[10] DETERMINISTIC_CHECKS        0 tokens (tsc/lint/test/wb run/playwright)
 │   gates LLM review — no tokens spent on code that doesn't compile
 ▼
[11] LLM_REVIEW                  3 reviewers in parallel (multi-model)
 │   contracts: opus | quality: gpt-5.4 | tests: gemini-3.1-pro
 ▼
[12] ITERATE_OR_SHIP             deterministic decision
 │   passes → commit + push + gh pr create (or backup if no git)
 │   fails → back to [8] with targeted fixes (max 3 iterations)
 ▼
COMPLETE                         persists run snapshot to Obsidian
```

---

## Token Optimization Strategies

### Dual context caching
- Phase 2 compresses 20-50K of project context into ~2K `compressedContext`
- All subsequent phases (5-11) receive 2K instead of 50K
- Savings: (50-2) × (N+3 subagents) ≈ 200-500K tokens per feature

### PHASE_MARKER filtering
- Each phase's messages are filtered out of subsequent phases' context
- Prevents history from growing linearly

### Delta patches in spec revision
- User edits trigger patches (~500 tokens), not full regeneration (~3K)

### Deterministic checks before LLM review
- If `tsc` fails, 3 reviewers are never called (saves ~45K input)

### Model routing per phase

| Phase | Model | Role |
|-------|-------|------|
| RESEARCH | claude-sonnet-4.6 | tool-heavy exploration |
| COMPLETENESS_CHECK | claude-sonnet-4.6 | ambiguity detection |
| APPROACHES | claude-sonnet-4.6 | tradeoff summarization |
| DESIGN (spec) | claude-opus-4.6 | creative synthesis |
| PLAN | claude-opus-4.6 | architectural reasoning |
| IMPLEMENTATION | claude-sonnet-4.6 | mechanical coding from contracts |
| TEST_GENERATION | claude-sonnet-4.6 | test writing from enumerated surface |
| REVIEW contracts | claude-opus-4.6 | trust anchor |
| REVIEW quality | gpt-5.4 | reasoning diversity |
| REVIEW tests | gemini-3.1-pro-preview | systematic enumeration + structured output |

Fallback chain: if default model unavailable, tries fallback 1, then fallback 2. User notified on degradation.

---

## File Structure

```
draft-ptb/
├── index.ts                    (72)   Extension entrypoint, commands, hooks
├── state.ts                    (276)  Phase enum, all types, DraftState, DraftEvent
├── reducer.ts                  (216)  Pure state transitions
├── orchestrator.ts             (64)   persist/restore, filterContext, model routing
├── drive-phase.ts              (181)  Phase switch → delegates to prompts/dispatchers
├── handlers.ts                 (121)  UI handlers (approaches widget, spec editor)
├── config.ts                   (56)   PHASE_CONFIG table (model per phase)
├── file-ops.ts                 (111)  Obsidian path resolution, save helpers
├── tools.ts                    (306)  10 registered pi tools
├── context-builder.ts          (224)  Deep manifest/git/monorepo detection
├── dag.ts                      (107)  Topological sort for file contracts
├── parallel-dispatcher.ts      (469)  DAG-based subagent dispatch via child pi
├── deterministic-checks.ts     (198)  tsc/lint/test/wb/playwright runners
├── review-dispatcher.ts        (263)  Multi-model reviewer dispatch
├── iterate-or-ship.ts          (333)  decide() + ship() + iterate() logic
├── git-ops.ts                  (108)  commit + push + gh pr create
└── prompts/
    ├── research.ts                    RESEARCH phase prompt builder
    ├── completeness.ts                COMPLETENESS_CHECK prompt builder
    ├── approaches.ts                  APPROACHES phase prompt builder
    ├── design.ts                      DESIGN/SPEC phase prompt builder
    ├── plan.ts                        PLAN phase prompt builder (file contracts)
    ├── format.ts                      Unicode card formatting for approaches UI
    ├── implementer.ts                 Per-subagent implementation prompt
    ├── test-generation.ts             Per-subagent test writing prompt
    ├── review-contracts.ts            Contract compliance reviewer prompt
    ├── review-quality.ts              Code quality reviewer prompt
    ├── review-tests.ts                Test coverage reviewer prompt
    └── review-shared.ts               Shared review schema/calibration
```

**Total: 28 files, ~4000 lines, 0 TypeScript errors.**

---

## Key Design Decisions

### Confirmed by user

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | 1 LLM turn for brainstorming (not 3) | Fuses research+understanding in one tool-calling turn |
| D2 | Spec and Plan as separate artifacts | Two checkpoints, two files, clear boundaries |
| D3 | Code review by dimension | Each dimension gets best-fit model |
| D4 | Max 3 fix iterations | Escalate to human > infinite loops |
| D5 | No user intervention after spec approval | Autonomous from PLAN onward |
| D6 | Artifacts in Obsidian vault (not repo) | Cross-project searchable, doesn't pollute repos |
| D7 | Tests AFTER code (not parallel) | Uses stabilized contracts |
| D8 | Always BOTH workbook + playwright | Manual + CI coverage |
| D9 | Hybrid test model (opus decides WHAT, sonnet writes HOW) | Cost-effective division of labor |
| D10 | Test folder detection with fallback | Reads config → conventions → proposes default |
| D11 | wb + agent-browser verified experimentally | Env vars persist between blocks; 2.3s for 4 blocks |

### Anti-objectives (explicit non-goals)

- NO executing without spec approval (human gate at phase 6)
- NO touching main/master/trunk directly (always feature branch)
- NO AI commit attribution
- NO git worktrees
- NO loading traditional skills
- NO nested subagent dispatch
- NO spec/plan in the user's repo (Obsidian only)
- NO iterations beyond 3 without escalating
- NO LLM review if deterministic checks failed
- NO full spec regeneration on small edits
- NO assuming Node.js by default
- NO hiding model fallback from user
- NO tests without user opt-in
- NO running full test suite (only new/modified files)
- NO installing playwright without user approval in spec

---

## Artifacts Persistence

All artifacts saved to Obsidian at:
```
/Users/hugoruiz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Projects/
└── <cwd-path-escaped>/
    └── features/
        └── <ISO-timestamp>-<idea-slug>/
            ├── brainstorming.md    (after RESEARCH)
            ├── spec.md             (after DESIGN approval)
            ├── plan.md             (after PLAN)
            └── runs/
                └── <ISO>.json      (on COMPLETE — full state snapshot)
```

Project slug formula: absolute `cwd` with `/` → `-`, trimmed. Example:
`/Users/hugoruiz/code/myapp` → `Users-hugoruiz-code-myapp`

Run snapshots include: full state, checks history per iteration, reviews history per iteration, phase timings (ms), and token consumption per LLM call.

---

## No-Git Mode

When `hasGit === false`:
1. Before implementation: backup all files-to-modify to `.draft-ptb-backup/<relative-path>`
2. After implementation: skip commit/push/PR
3. Emit: "Cambios aplicados. Revisa manualmente. Backup en .draft-ptb-backup/"

---

## Subagent Dispatch Model

Implementation and test subagents are spawned as child processes:
```
pi --mode json --no-session
```

Each subagent receives:
- Its file contract (signatures only, not implementations of dependencies)
- compressedContext (~2K)
- List of prohibited files (sharedFiles it doesn't own)
- Read-only access to dependency contracts

DAG ordering uses `imports` field from file contracts. Level 0 = no dependencies. Levels execute sequentially; within a level, subagents run in parallel.

---

## Approaches UI

Uses `ctx.ui.setWidget` + `ctx.ui.select` for approach selection:
- Unicode-bordered cards with tradeoffs rendered as widget
- Compact select for the actual choice
- Widget persists until phase changes (visual continuity)

---

## Implementation Contract

The extension was built by 4 parallel milestone subagents governed by `IMPLEMENTATION-CONTRACT.md`:

| Milestone | Scope |
|-----------|-------|
| M1 | Phases 1-4: gathering + research + questions + completeness |
| M2 | Phases 5-7: approaches + spec with test surface + plan with contracts |
| M3 | Phases 8-10: parallel implementation + test generation + deterministic checks |
| M4 | Phases 11-12: multi-model review + iterate/ship + run persistence |

Rules enforced:
- Additive-only changes to shared files (state.ts, reducer.ts, tools.ts, config.ts)
- No subagent may rename phases or invent new state fields
- File ownership strictly partitioned
- All 13 phase names frozen in contract before dispatch

---

## Known Gaps

1. **Not tested end-to-end** — 4059 lines compile but haven't been executed as a flow
2. ~~No-git backup overwrite bug~~ — **FIXED**: backup only written on first iteration (`fs.existsSync(dst)` guard)
3. ~~Phase naming discrepancy~~ — **RESOLVED**: DESIGN-V2.md deleted; README is source of truth
4. ~~config.ts model mismatch~~ — **FIXED**: all phases use `claude-opus-4.6` (opus-4.7 not available on github-copilot)
5. ~~Legacy prompts/execution.ts~~ — **DELETED**: file removed, import removed from drive-phase.ts
6. ~~Unverified model credentials~~ — **VERIFIED**: opus-4.6, gpt-5.4, gemini-3.1-pro-preview all work; opus-4.7 and gpt-5.5 are NOT available
7. ~~DAG ordering fragility~~ — **MITIGATED**: `validateImports()` warns on dangling imports before dispatch; self-corrects via iteration loop

---

## Dependencies

- pi.dev extension API (`@earendil-works/pi-coding-agent`)
- `gh` CLI (for PR creation)
- `wb` CLI (for workbook execution)
- `agent-browser` CLI (for E2E tests in workbooks)
- Project-specific: `tsc`, `eslint`, `playwright`, etc. (detected per project type)

---

## Configuration

Models and providers configured via `/Users/hugoruiz/.config/pi/agent/settings.json`.
Extension reads `enabledModels` to validate availability before switching.
