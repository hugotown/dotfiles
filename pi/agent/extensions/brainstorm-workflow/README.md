# brainstorm-workflow

A pi extension that turns `--brainstorm <request>` into a guided, multi-phase
design exploration: it gathers project context, researches best practices, asks
strategic questions, proposes approaches, generates a sectioned design, runs a
self-review, and finally writes a markdown spec to disk — pausing for human
confirmation at every decision point.

The whole flow is a **deterministic state machine** that orchestrates a series
of constrained LLM turns. Each turn is locked to a specific model and a minimal
toolset so the model can only do one job at a time.

---

## Trigger

Two entry points, both resolving to the same workflow:

| Entry point            | Mechanism                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `--brainstorm <text>`  | `pi.on("input")` — intercepts and short-circuits the LLM turn |
| `/brainstorm <text>`   | `pi.registerCommand` — just rewrites to `--brainstorm <text>` |

Both require an interactive UI (`ctx.hasUI`). In `print` / `json` / `rpc` modes
the workflow refuses to start.

---

## The state machine

`state.ts` owns a single `BrainstormState` object and a pure `transition()`
reducer. Every transition is guarded by the current `phase`, so out-of-order
events are ignored (the reducer returns the state unchanged). Phases:

```
IDLE
  └─ START ─────────────► GATHERING_CONTEXT
        └─ CONTEXT_GATHERED ─► RESEARCHING_AND_QUESTIONING ◄─┐
              └─ QUESTIONS_RECEIVED ─► FORM_INTERACTION       │
                    └─ FORM_CONFIRMED ─┬─(more)──────────────┘
                                       └─(done)─► PROPOSING_APPROACHES
                                             └─ APPROACHES_RECEIVED ─► APPROACH_SELECTION
                                                   └─ APPROACH_SELECTED ─► GENERATING_DESIGN
                                                         └─ DESIGN_RECEIVED ─► DESIGN_REVIEW
                                                               └─ DESIGN_APPROVED ─► WRITING_SPEC
                                                                     └─ SPEC_WRITTEN ─► SELF_REVIEW
                                                                           └─ REVIEW_RECEIVED ─► USER_REVIEW
                                                                                 └─ USER_APPROVED ─► COMPLETE
RESET ──► IDLE   (from any phase: cancel / abort)
```

The state is **persisted after every transition** via
`pi.appendEntry("brainstorm-state", state)` and **restored on `session_start`**
by scanning the session branch for the latest `brainstorm-state` custom entry.
This lets a brainstorm survive a session reload mid-flow.

### Model and tool gating per phase

Each phase swaps the active model and restricts the toolset so the model is
forced into a single responsibility:

| Phase                        | Model  | Active tools                       |
| ---------------------------- | ------ | ---------------------------------- |
| RESEARCHING_AND_QUESTIONING  | Sonnet | `bash`, `brainstorm_questions`     |
| PROPOSING_APPROACHES         | Sonnet | `brainstorm_approaches`            |
| GENERATING_DESIGN            | Opus   | `brainstorm_design`                |
| DESIGN_REVIEW (revision)     | Sonnet | `brainstorm_design_revision`       |
| SELF_REVIEW                  | Opus   | `brainstorm_review`                |
| auto-fix after review        | Sonnet | `brainstorm_design`                |

The original model and the full tool list are captured at start
(`allToolNames`) and restored on completion, cancel, or abort.

---

## Directory map

```
brainstorm-workflow/
├── index.ts          Entry point: registers tools/command, wires the workflow
│                     handler onto the facade, and drives the state machine via
│                     the `tool_result` event handler.
├── state.ts          BrainstormState type + createInitialState() + transition().
├── types.ts          Shared interfaces (Phase, Assumption, Question, Approach,
│                     DesignSection, ReviewIssue, ReviewResult, Wireframe).
├── lib/
│   ├── prompts.ts    System prompts for each LLM step (research, approaches,
│   │                 design, revision, review, auto-fix).
│   ├── compress.ts   Deterministic project-context compression (tree filtering,
│   │                 package.json / config extraction, ~8000 char hard cap).
│   └── wireframe.ts  Renders {{color}} / {{bold}} tags to theme.fg() for TUI.
├── steps/
│   ├── gather-context.ts   Step 1: eza tree + find configs + graphify check.
│   ├── questions.ts        TUI: questions form with submenus + feedback editor.
│   ├── approaches.ts       TUI: approach selector.
│   ├── design-review.ts    TUI: section-by-section approve / request-changes.
│   ├── self-review.ts      TUI: review issues + auto-fix prompt.
│   ├── user-review.ts      TUI: final spec approval.
│   └── write-spec.ts       Step 6: assemble + write markdown spec to docs/.
├── tools/
│   ├── brainstorm-questions.ts          Custom tools the model calls to hand
│   ├── brainstorm-approaches.ts         structured data back to the state
│   ├── brainstorm-design.ts             machine. Each returns `terminate: true`
│   ├── brainstorm-design-revision.ts    and a `details` payload that the
│   └── brainstorm-review.ts             `tool_result` handler consumes.
└── tests/            Unit tests for compress, state, wireframe, write-spec.
```

### How the loop is driven

The model never advances the workflow on its own. The pattern is:

1. The state machine sends a system-style prompt with `pi.sendUserMessage(...,
   { deliverAs: "followUp" })` and restricts the toolset.
2. The model's only legal move is to call the one custom tool available for that
   phase. Those tools do nothing but echo their typed arguments back in
   `details` and set `terminate: true`.
3. The `pi.on("tool_result", ...)` handler in `index.ts` matches on
   `toolName` + current `phase`, advances the state machine, shows the relevant
   TUI step, and fires the next prompt.

So the custom tools are **structured-output channels**, not actions — they exist
so the model returns validated JSON (via typebox schemas) instead of free text.


## Output

On success the workflow writes a markdown spec to:

```
<cwd>/docs/superpowers/specs/<YYYY-MM-DD>-<title-slug>-design.md
```

containing the title, chosen approach, validated assumptions, a
question/answer/reasoning table, and every design section.

---

## Tests

`tests/` covers the pure, deterministic pieces — `compress`, `state` (the
reducer), `wireframe`, and `write-spec`. The LLM-driven and TUI steps are not
unit-tested.
