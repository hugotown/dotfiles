# Design Spec — `dev-pipeline` pi extension

**Date:** 2026-05-23
**Status:** Approved (design phase)
**Target runtime:** pi coding agent `@earendil-works/pi-coding-agent@0.75.4`
**Location:** `agent/extensions/dev-pipeline/` (auto-discovered via `~/.pi/agent/extensions/`, a symlink to `~/.config/pi`)

---

## 1. Purpose & core principle

A self-contained pi extension that implements a deterministic **dev pipeline** state machine
(`Context → Brainstorm → Spec → Plan → Implement → Review → Notes`) for AI-assisted coding.

**Core principle:** the LLM does not orchestrate — it only *creates*. All control flow and phase
transitions live in the extension's TypeScript as a deterministic state machine. The LLM is invoked
only for the creative steps, each with fresh, compressed context and a minimal toolset. Phases hand
off via **files** (the LLM writes a markdown artifact with the built-in `write` tool; later phases
read it). There is **no structured-output JSON parsing for control flow**, and **no custom tools** —
only pi's built-in tools (`read, bash, edit, write, grep, find, ls`), scoped per phase.

---

## 2. Verified pi API surface (anti-hallucination reference)

All signatures below were confirmed against the installed package's `dist/*.d.ts`, `docs/extensions.md`,
and `examples/` (notably `plan-mode/`, `send-user-message.ts`, `tools.ts`). The implementation plan
MUST use these exact signatures.

| Capability | API | Notes |
|---|---|---|
| Intercept input | `pi.on("input", (e,ctx)=>…)` | `e.text`, `e.source` (`"interactive"\|"rpc"\|"extension"`). Return `{action:"continue"}` / `{action:"transform",text}` / `{action:"handled"}` |
| Register flag | `pi.registerFlag(name,{description,type:"boolean"\|"string",default?})` | `pi.getFlag(name)` to read |
| Register command | `pi.registerCommand(name,{description,handler:(args,ctx)=>Promise<void>})` | |
| Detect creative step finished | `pi.on("agent_end",(e,ctx)=>…)` | fires once per user prompt, after all turns/tool calls; `e.messages` |
| Per-turn progress (optional) | `pi.on("turn_end",(e,ctx)=>…)` | `e.turnIndex,e.message,e.toolResults` |
| Inject the phase prompt | `pi.sendUserMessage(content,{deliverAs?:"steer"\|"followUp"})` | always triggers a turn; when idle, send with no opts |
| Filter context per phase | `pi.on("context",(e,ctx)=>({messages:filtered}))` | `e.messages` is a deep copy, safe to modify |
| Set model | `await pi.setModel(model)` → `Promise<boolean>` (false if no API key) | |
| Find model | `ctx.modelRegistry.find(provider,modelId)` → `Model\|undefined` | current model: `ctx.model` |
| Scope tools | `pi.setActiveTools(string[])`, `pi.getActiveTools()`, `pi.getAllTools()` | built-ins: `read,bash,edit,write,grep,find,ls` |
| Persist state | `pi.appendEntry(customType, data)` | not part of LLM context |
| Read prior entries | `ctx.sessionManager.getBranch()` → `SessionEntry[]` | custom entry: `{type:"custom",customType,data}` |
| Deterministic shell (0 tokens) | `await pi.exec(command,args,{timeout?})` → `{code,stdout,stderr}` | used for eza/rg/stack/probes |
| UI dialogs (awaitable) | `ctx.ui.select(title,options,opts?)`, `ctx.ui.confirm(title,msg,opts?)`, `ctx.ui.input(title,placeholder?,opts?)`, `ctx.ui.editor(title,prefill?)` | |
| UI custom component | `ctx.ui.custom<T>(factory,options?)` → `Promise<T>` | for the questions form |
| UI status/notify | `ctx.ui.setStatus(key,text\|undefined)`, `ctx.ui.notify(msg,"info"\|"warning"\|"error")` | |
| Interactive guard | `ctx.hasUI` | `false` in print/json mode → refuse to start |

---

## 3. Trigger & lifecycle (FR-1, FR-4 / NFR-4, NFR-6)

- `pi.registerFlag("pipeline",{type:"string",description:…})`.
- `pi.on("input")`: if `event.text` contains `--pipeline <activity>`, strip the token, capture `<activity>`,
  start the state machine, and return `{action:"handled"}`. All other input returns `{action:"continue"}`
  untouched. Ignore `event.source === "extension"` (the extension's own injected messages) to avoid loops.
- `/pipeline <activity>` alias via `pi.registerCommand` (rewrites to `--pipeline …`).
- **Self-containment (FR-3/NFR-6):** zero external workflow/config files. A clean install runs end-to-end
  reading only the target project's own source.
- **Resume (FR-4/NFR-4):** after every transition call `pi.appendEntry("dev-pipeline-state", state)`.
  On `session_start`, scan `ctx.sessionManager.getBranch()` for the latest `custom` entry with
  `customType === "dev-pipeline-state"` and restore. Re-arms at the exact phase with prior decisions intact.
- Requires `ctx.hasUI`; refuse in print/json/rpc-headless modes.

---

## 4. State machine (FR-2 / NFR-1)

A single `PipelineState` object and a pure `transition(state, event, payload)` reducer. Every transition
is guarded by the current `phase`; out-of-order events return state unchanged. Deterministic transitions
cost **0 LLM tokens**.

```
IDLE
 └─START→ GATHERING_CONTEXT
   └─CONTEXT_READY→ BRAINSTORM ◄─┐ (question rounds)
        └─PROCEED→ SPEC          │ (loop until user "proceed" or max_iterations=10)
          └─SPEC_WRITTEN→ SPEC_SELF_REVIEW
            └─REVIEWED→ SPEC_GATE ──reject(feedback)──► SPEC (revise, bounded by attempts)
              └─APPROVED→ PLAN_RESEARCH
                └─RESEARCH_DECIDED→ (deterministic research) → PLAN_AUTHOR
                  └─PLAN_WRITTEN→ PLAN_SELF_REVIEW
                    └─REVIEWED→ PLAN_GATE ──reject──► PLAN_AUTHOR
                      └─APPROVED→ IMPLEMENT ◄─┐ (per-task TDD loop)
                        └─task done / next ───┘
                          └─ALL_TASKS_DONE→ REVIEW   (or BLOCKED → halt)
                            └─REVIEWED→ NOTES
                              └─NOTES_WRITTEN→ COMPLETE
RESET → IDLE  (cancel/abort from any phase; restores original model + tools)
```

**Persisted state shape (`state.ts`):**

```ts
interface PipelineState {
  phase: Phase;
  activity: string;                 // the <activity> from --pipeline
  artifactFolder: string | null;    // ~/obsidian/Documents/<mangled-cwd>
  slug: string | null;              // kebab-case feature name
  compressedContext: string;        // ≤ ~2K tokens
  decisions: string;                // brainstorm outcome (free text / decisions.md content)
  questionRound: number;            // brainstorm loop counter (cap = maxIterations)
  specPath: string | null;
  planPath: string | null;
  tasks: { id: number; title: string; status: "pending"|"done"|"blocked" }[];
  currentTaskIndex: number;
  reviewVerdict: "APPROVED" | "CHANGES_REQUIRED" | null;
  notesPath: string | null;
  originalModel: { provider: string; id: string } | null;
  allToolNames: string[];           // captured at start, restored at end
  gateAttempts: number;             // bounds reject→revise loops
}
```

---

## 5. Deterministic context gathering — 0 tokens (FR-5 … FR-9)

All via `pi.exec(...)` from the extension; no LLM involvement.

- **FR-5 artifact folder:** compute `~/obsidian/Documents/<abs-cwd with leading "/Users/" removed and "/"→"_">`,
  create if absent. Example: cwd `/Users/hugoruiz/work/Developer/x` → `~/obsidian/Documents/hugoruiz_work_Developer_x`.
  (`~/obsidian/Documents` confirmed to exist.)
- **FR-6 tree:** `eza --tree --level=3` excluding `node_modules,.git,dist,build,.next,__pycache__,target,.venv,coverage`.
- **FR-7 stack:** detect manifests (`package.json,pyproject.toml,Cargo.toml,go.mod,…`) and emit only compressed
  signal — dependency **names** + script **names**, never full files. (`package.json` → name + dep names + script names.)
- **FR-8 probes:** return `{ ast_grep: boolean, graphify: boolean }` — `ast-grep` present on PATH; `graphify-out/` dir exists.
- **FR-9 compression:** compress all gathered context to ≤ ~2,000 tokens (hard char cap ~8K) before any LLM injection.

---

## 6. The generic phase driver (FR-27, FR-28, FR-29 / NFR-7)

A single `runPhase({ model, tools, contextInputs, prompt, outputFile })` helper:

1. `await pi.setModel(model)` (§8 routing) and `pi.setActiveTools(tools)` (§8 scoping).
2. **Fresh context (FR-28):** the `context` event handler trims `event.messages` to only the declared inputs
   for the active phase (no prior-phase chatter). Exception: the Brainstorm question loop retains the dialogue.
3. `pi.sendUserMessage(prompt)` — the prompt instructs the LLM to write `outputFile` with `write`.
4. On `agent_end` (matched by current `phase`): if `outputFile` is missing or empty → **halt the phase with a
   clear error** (NFR-2: never emit empty output for downstream phases). If valid → advance the state machine,
   persist, and drive the next phase.

The state machine knows the current phase and only ever has one phase-prompt in flight, so each `agent_end`
maps unambiguously to its phase (the `plan-mode` example uses this exact pattern). Control flow depends only
on **file existence/validity + `agent_end`**, never on parsing LLM text (FR-30 / NFR-3).

---

## 7. Phases

### 7.1 Brainstorm — sonnet, interactive (FR-10/11/12)
- LLM (read-only tools) writes `<folder>/<slug-or-tmp>-questions.md`: ≤5 highest-value questions in a **strict
  line format** (`Q:` / `DEFAULT:` / `WHY:` per block), plus anything inferable stated as an **assumption**
  (never asked).
- The extension renders a **TUI form** (`ctx.ui.custom`) with each question's default pre-filled, **plus a
  free-text "additional comments / refute" field** so the user can reject the whole premise if the LLM
  misunderstood or the questions/answers are wrong.
- Answer or refute → new round (LLM re-evaluates, drops refuted assumptions). Loop ends only on explicit
  user **"proceed"** or `max_iterations = 10` (default). Agreed decisions are written to `<>-decisions.md`
  for the Spec phase (FR-12 — Spec receives decisions without re-asking).
- **FR-30 compliance note:** parsing the questions file is for *rendering the UI only*; control flow never
  depends on it. **Fallback:** if parsing yields 0 valid questions, show the raw file content + the comments
  field (never crash).

### 7.2 Spec — opus (FR-13/14/15/16)
- Derive `<slug>`: LLM-named from decisions, sanitized to `[a-z0-9-]+`.
- Write `<folder>/<YYYY-MM-DD>-<slug>-design.md`, sections scaled to complexity, **zero placeholders** (no TBD/TODO).
- **Self-review (opus):** re-read and fix inline only real issues (contradiction, ambiguity, placeholder, gap,
  scope creep); report "clean" or the fixes made.
- **Human gate:** `ctx.ui` approve / reject-with-feedback (feedback via `ctx.ui.editor`). Reject → revise and
  re-present, bounded by `gateAttempts`. Approve advances.

### 7.3 Plan — sonnet research + opus authoring (FR-17/18/19/20/21)
- **FR-17:** the LLM decides *what* to research (code patterns, files of interest, libraries) and returns the
  lists — it executes nothing itself.
- **FR-18 (deterministic execution by the extension):** `rg` always; `ast-grep` only if available; `graphify`
  query only if `graphify-out/` exists; `ctx7` for named libraries. A missing tool yields **empty results,
  never an error** — the run continues with that section empty.
- **FR-19:** opus writes `<folder>/<YYYY-MM-DD>-<slug>-plan.md` as bite-sized TDD tasks with exact paths and
  **complete real code per step**; no "similar to Task N" / TBD. **(Override — see §9: tasks are
  `failing test → minimal code → pass`, the `→ commit` step is removed.)**
- **FR-20 self-review (opus):** spec coverage, placeholders, type/signature consistency, fixed inline;
  every spec requirement maps to a task.
- **FR-21 human gate:** same semantics as the Spec gate.

### 7.4 Implement — sonnet, single-agent TDD (FR-22/24; FR-23 modified — see §9)
- Per-task sub-loop with `read,write,edit,bash`, **no subagents**.
- Per task: the LLM writes the failing test, then the minimal code. The **extension verifies deterministically**
  by running the project's detected test command via `pi.exec` and confirming green before advancing.
- **No commits, no branches, no worktrees** (§9). Runs in the live checkout; leaves all changes **uncommitted**
  in the working tree for the user to review and commit manually.
- **FR-24:** on a task that cannot pass after honest effort, **halt with a BLOCKED report** rather than weakening
  a test. A forced-fail task produces BLOCKED, not a passing fake test.

### 7.5 Review — opus (FR-25)
- Read the **`git diff`** of the working tree (not prior reports). Output `Verdict: APPROVED | CHANGES REQUIRED`
  plus findings grouped Critical / Important / Minor with `file:line`. (Since nothing is committed, the working-tree
  diff contains the full change set.)

### 7.6 Notes — sonnet (FR-26)
- Write `<folder>/<YYYY-MM-DD>-<slug>-implementation.md`: what shipped per task, files changed, deviations,
  test status, verdict; outstanding issues if CHANGES REQUIRED. (No commit references — §9.)

---

## 8. Model routing & tool scoping (FR-27, FR-29 / NFR-9)

Model IDs live in configurable constants (NFR-9). Provider `github-copilot` and both models confirmed present
in `enabledModels`.

| Phase | Model | Active tools |
|---|---|---|
| Brainstorm | `github-copilot/claude-sonnet-4.6` | `read,grep,find,ls` |
| Spec / Spec-review | `github-copilot/claude-opus-4.6` | `read,grep,find,ls,write` |
| Plan research | `github-copilot/claude-sonnet-4.6` | `read,grep,find,ls,bash` (read-only) |
| Plan author / Plan-review | `github-copilot/claude-opus-4.6` | `read,grep,find,ls,write` |
| Implement | `github-copilot/claude-sonnet-4.6` | `read,write,edit,bash` |
| Code-review | `github-copilot/claude-opus-4.6` | `read,grep,find,ls` |
| Notes | `github-copilot/claude-sonnet-4.6` | `read,grep,find,ls,write` |

No MCP, no external/custom tools (NFR-7). On COMPLETE / cancel / abort, restore `originalModel` and `allToolNames`
(current session default is `github-copilot/claude-opus-4.6`).

---

## 9. Explicit decisions & overrides

1. **NO COMMITS (overrides FR-19's `→ commit`, FR-22/FR-23 commit semantics).** Per user instruction, the
   extension never commits and never creates branches or worktrees. Implement runs TDD in the live checkout and
   leaves changes uncommitted; the user reviews and commits manually. NFR-5 (no branch/worktree mutation) is
   preserved and strengthened (no commits at all).
2. **Deterministic verification, not LLM self-report:** after each Implement task, the extension runs the test
   command via `pi.exec` to confirm green (the LLM's claim is verified, not trusted) — but does not commit.
3. **Questions-form fallback:** if the strict-format parse yields 0 questions, render raw file + comments field.

---

## 10. Module layout (SOLID; matches `gemini` extension convention)

```
agent/extensions/dev-pipeline/
├── package.json            # pi.extensions:["./index.ts"]; deps: pi-coding-agent@0.75.4, pi-tui@0.75.4
├── tsconfig.json           # ESNext/bundler/strict, types:["node"]  (copied from gemini)
├── README.md               # setup + usage + smoke test
├── index.ts                # wiring: flag, command, on(input/agent_end/context/session_start/turn_*)
├── state.ts                # PipelineState + createInitialState() + pure transition()
├── orchestrator.ts         # setModel/setActiveTools/persist/context-filter/restore helpers
├── context/
│   ├── gather.ts           # eza tree + stack detect + probes via pi.exec (0 tokens)
│   └── compress.ts         # ≤2K-token compression (~8K char cap)
├── phases/
│   ├── brainstorm.ts spec.ts plan.ts implement.ts review.ts notes.ts
├── ui/
│   ├── questions-form.ts   # ctx.ui.custom form (defaults + comments/refute field + fallback)
│   └── approval-gate.ts    # approve / reject-with-feedback (ctx.ui.editor)
├── lib/
│   ├── paths.ts            # artifact-folder mangling + slug sanitization
│   └── prompts.ts          # per-phase system/step prompts
└── tests/                  # bun unit tests for deterministic pieces
    ├── state.test.ts compress.test.ts paths.test.ts gather.test.ts questions-parse.test.ts
```

---

## 11. Testing & smoke test (build prompt)

- **Unit tests (bun)** for the deterministic, pure pieces: `transition()` reducer, `compress`, artifact-folder
  mangling + slug sanitization, stack detection, questions-file parsing (incl. the 0-questions fallback).
- **Smoke test:** run the deterministic path (`gather → compress → paths`) against a tiny sample repo and assert
  the excluded dirs are omitted, the folder mangling matches FR-5, and the compressed context stays within budget.
- LLM-driven and TUI steps are not unit-tested (matches the prior repo convention).

---

## 12. Non-functional requirements traceability

| NFR | How satisfied |
|---|---|
| NFR-1 token efficiency | Deterministic steps via `pi.exec` (0 tokens); per-phase context ≤2K via `context` filter + compress |
| NFR-2 no silent cascades | `runPhase` halts a phase if its output file is missing/empty; never feeds empty downstream |
| NFR-3 robust handoffs | Native `write`/`read` + `agent_end`; zero JSON-parse points in control flow |
| NFR-4 resumability | `appendEntry` after each transition; restore on `session_start` |
| NFR-5 no isolation side effects | Live checkout; no branch/worktree; **no commits** (§9) |
| NFR-6 self-containment | Zero external config; reads only the target project's source |
| NFR-7 security/blast radius | pi built-ins only, scoped per phase; no network/MCP/external; writes confined to repo (code) + Obsidian folder (docs) |
| NFR-8 observability | Each phase sets `ctx.ui.setStatus` start/end + outcome; artifacts are durable files |
| NFR-9 cost control | Opus only for spec/plan/review; sonnet elsewhere; model IDs in configurable constants |
| NFR-10 UX v1 | Text-based interactive gates (`ctx.ui`); refute/iterate supported; rich TUI deferred |

---

## 13. Functional requirements traceability

FR-1…FR-9 → §3, §5. FR-10/11/12 → §7.1. FR-13/14/15/16 → §7.2. FR-17/18/19/20/21 → §7.3.
FR-22/24 → §7.4 (FR-23 modified → §9). FR-25 → §7.5. FR-26 → §7.6. FR-27/28/29 → §6, §8.
FR-30 → §6, §7.1 note.
