# Design Spec: Brainstorming Workflow Extension

**Date:** 2026-05-23
**Approach:** Hybrid workflow extension (state machine + LLM only when needed)

---

## Overview

Convert the brainstorming skill from a SKILL.md (LLM orchestrates every step) into a pi extension that acts as a state machine. The extension handles deterministic steps inline (0 tokens) and delegates creative steps to the LLM with focused, compressed prompts. Uses model routing (sonnet for research, opus for design/review).

**Trigger:** `--brainstorm` flag in user input
**Token savings:** ~84% fewer tokens vs current approach
**Quality improvement:** opus for critical steps, compressed context per turn

---

## State Machine

```
IDLE
  │ trigger: --brainstorm
  ▼
GATHERING_CONTEXT (deterministic)
  │ eza + rg + cat + graphify check
  ▼
VISUAL_COMPANION (TODO: deferred)
  │
  ▼
RESEARCHING_AND_QUESTIONING (LLM: sonnet)
  │ ctx7 + ddg + brainstorm_questions tool
  ▼
FORM_INTERACTION (deterministic: TUI)
  │ user fills SettingsList form
  │ ├─ challenge assumption → LLM re-iterates → back to form
  │ └─ confirm → check if LLM says done
  │      ├─ not done → back to RESEARCHING
  │      └─ done ▼
PROPOSING_APPROACHES (LLM: sonnet)
  │ brainstorm_approaches tool (with wireframes)
  ▼
APPROACH_SELECTION (deterministic: TUI)
  │ user picks approach
  ▼
GENERATING_DESIGN (LLM: opus)
  │ brainstorm_design tool
  ▼
DESIGN_REVIEW (deterministic: TUI, section by section)
  │ ├─ approve section → next section
  │ └─ [R] request changes → LLM (sonnet) revises section → re-present
  │ all approved ▼
WRITING_SPEC (deterministic)
  │ assemble markdown + fs.writeFile
  ▼
SELF_REVIEW (LLM: opus)
  │ brainstorm_review tool
  │ ├─ pass → advance
  │ └─ issues → auto-fix (sonnet) → re-review (opus)
  │      └─ still unresolved (rare) → present to user → guidance → fix
  ▼
USER_REVIEW (deterministic: TUI)
  │ ├─ approve → COMPLETE
  │ └─ [R] request changes → LLM (sonnet) applies → re-confirm
  ▼
COMPLETE
  │ notify user, deactivate workflow
  ▼
IDLE
```

---

## Step 1: Exploration (Deterministic)

### Substeps

1. **Project tree**
   ```bash
   eza --tree --level=5 .
   ```

2. **Detect config files**
   ```bash
   rg --files | rg "(package\.json|pyproject\.toml|Cargo\.toml|pom\.xml|build\.gradle|turbo\.json|mise\.toml|composer\.json|Gemfile|go\.mod|deno\.json|tsconfig\.json|angular\.json|nx\.json)$"
   ```

3. **Read each config**
   ```bash
   cat <found_config>
   ```

4. **Check graphify-out**
   ```bash
   test -d graphify-out && echo "EXISTS" || echo "NOT_FOUND"
   ```

5. **If graphify exists** → requires LLM to determine keywords (handled in step 3's LLM turn — the LLM uses the gathered context to form graphify queries)

### Context Compression (Deterministic)

All outputs are compressed before injection:

- **Tree:** Filter out `node_modules`, `.git`, `dist`, `build`, `.next`, `__pycache__`, `target/debug`
- **package.json:** Extract only `name`, `dependencies` (keys), `devDependencies` (keys), `scripts` (keys)
- **pyproject.toml / Cargo.toml / etc:** Extract project name + dependencies list
- **graphify results:** Already compact by nature

Target: compressed context ≤ 2,000 tokens regardless of project size.

---

## Step 2: Visual Companion

```
// TODO: add visual companion
// Deferred to future phase. When implemented:
// - Offer via TUI confirm (0 tokens)
// - If accepted, read skills/brainstorming/visual-companion.md
// - Enable browser-based mockups during questioning phase
```

---

## Step 3: Research + Strategic Questions (LLM: sonnet)

### Available Tools (restricted set)

| Tool | Purpose |
|---|---|
| `bash` (for ctx7) | Technical documentation lookup |
| `bash` (for ddg) | General best practices, market standards, fallback |
| `bash` (for graphify query, if graphify-out exists) | Codebase knowledge graph queries |
| `brainstorm_questions` | Deliver structured output + terminate turn |

### brainstorm_questions Tool Schema

```typescript
{
  name: "brainstorm_questions",
  parameters: Type.Object({
    done: Type.Boolean(),
    assumptions: Type.Optional(Type.Array(Type.Object({
      id: Type.String(),
      text: Type.String(),
      confidence: StringEnum(["high", "medium", "low"]),
    }))),
    questions: Type.Optional(Type.Array(Type.Object({
      id: Type.String(),
      label: Type.String(),
      type: StringEnum(["select", "text"]),
      options: Type.Optional(Type.Array(Type.String())),
      default: Type.String(),
      reasoning: Type.String(),
    }))),
  }),
  terminate: true
}
```

### System Prompt (Step 3)

```
You are a senior software architect doing pre-design research.

PHASE 1 - RESEARCH:
Research best practices for the user's request using the available tools:
- Use ctx7 to look up documentation for libraries detected in the project
- Use ddg for general best practices, market standards, proven patterns
- Use ddg as fallback when ctx7 doesn't have sufficient info
- If graphify-out exists, use graphify query for codebase-specific knowledge

PHASE 2 - QUESTIONS:
After researching, call brainstorm_questions with strategic questions.
Every question MUST have its default pre-filled with the best practice
you found during research. Rules:
- Do NOT ask what you can infer from project context — state it as an assumption
- Pre-fill defaults with RESEARCHED best practices, cite the source in reasoning
- Filter out options that contradict the detected stack
- If the answer is obvious from context + research, DON'T ASK — add it as
  an assumption with high confidence instead
- 2-5 questions per round. Fewer is better if high-value.
- Set "done": true when you have enough info to propose 2-3 design approaches

The user should only need to press Enter to accept your recommendations.
If they need to change something, it means your research missed something.
```

### TUI: SettingsList Form

```
┌─────────────────────────────────────────────────────────────────┐
│  Brainstorming: <user's request>                                │
│  ↑↓ navigate • enter activate • R challenge assumption          │
│                                                                 │
│  ▶ Confirm all                   press enter                    │
│                                                                 │
│  ── Assumptions (R to challenge) ──────────────────────────      │
│  ✓ <high confidence assumption>  (evidence)                     │
│  ~ <medium confidence assumption> (evidence)                    │
│                                                                 │
│  ── Questions ─────────────────────────────────────────────      │
│  <label>                         <default value>                │
│  <label>                         <default value>                │
│                                                                 │
│  ✗ Done, skip remaining          esc                            │
└─────────────────────────────────────────────────────────────────┘
```

### Challenge Assumption Flow

1. User navigates to assumption → presses R
2. Text input opens: "Your observation:"
3. User submits observation
4. Workflow sends to LLM (sonnet): assumption + observation + context
5. LLM re-iterates → updated assumptions + questions
6. Form re-renders

---

## Step 4: Propose Approaches (LLM: sonnet)

### brainstorm_approaches Tool Schema

```typescript
{
  name: "brainstorm_approaches",
  parameters: Type.Object({
    approaches: Type.Array(Type.Object({
      id: Type.String(),
      title: Type.String(),
      summary: Type.String(),
      pros: Type.Array(Type.String()),
      cons: Type.Array(Type.String()),
      effort: StringEnum(["low", "medium", "high"]),
      risk: StringEnum(["low", "medium", "high"]),
      wireframe: Type.Optional(Type.Object({
        description: Type.String(),
        lines: Type.Array(Type.String()),
      })),
    })),
    recommendation: Type.String(),
    recommendation_reasoning: Type.String(),
  }),
  terminate: true
}
```

### Wireframe Color Tags

LLM uses semantic color tags in wireframe lines:

```
{{accent}}  → theme.fg("accent", ...)   — primary actions, headings
{{success}} → theme.fg("success", ...)  — CTAs, confirmations
{{warning}} → theme.fg("warning", ...)  — caution areas
{{error}}   → theme.fg("error", ...)    — destructive actions
{{muted}}   → theme.fg("muted", ...)    — placeholder text
{{dim}}     → theme.fg("dim", ...)      — separators, secondary
{{bold}}    → theme.bold(...)           — emphasis
```

### System Prompt (Step 4)

```
You are a senior software architect proposing design approaches.

Context provided:
- Compressed project context
- Research findings from ctx7/ddg
- Validated assumptions
- User's answers to strategic questions

Generate 2-3 approaches with clear tradeoffs. Call brainstorm_approaches with:
- Each approach: title, summary (2-3 sentences), pros, cons, effort, risk
- Your recommendation with detailed reasoning
- Optional wireframe (ONLY for visual decisions: UI layout, screen flow)

WIREFRAME RULES (when applicable):
- Use box-drawing characters (┌─┐│└┘) for structure
- Use {{color}} tags for semantic meaning
- Keep under 20 lines — convey layout, not pixel-perfect design
- Only include when the approach involves a VISUAL decision
```

### TUI: Approach Selector

```
┌─────────────────────────────────────────────────────────────────────┐
│  Approaches                                                         │
│  ↑↓ navigate • enter select • V view details                       │
│                                                                     │
│  ★ A. <recommended title>                                           │
│       effort: low • risk: low                                       │
│    B. <alternative title>                                           │
│       effort: medium • risk: medium                                 │
│    C. <alternative title>                                           │
│       effort: low • risk: low                                       │
│                                                                     │
│  ── Recommendation ──────────────────────────────────────────────    │
│  <detailed reasoning>                                               │
│                                                                     │
│  [Enter] select  [V] view pros/cons + wireframe  [Esc] abort        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 5: Generate Design (LLM: opus)

### brainstorm_design Tool Schema

```typescript
{
  name: "brainstorm_design",
  parameters: Type.Object({
    title: Type.String(),
    sections: Type.Array(Type.Object({
      id: Type.String(),
      title: Type.String(),
      content: Type.String(), // markdown
      wireframe: Type.Optional(Type.Object({
        description: Type.String(),
        lines: Type.Array(Type.String()),
      })),
    })),
  }),
  terminate: true
}
```

### System Prompt (Step 5)

```
You are a senior software architect producing a complete design.

Generate a design structured in sections. Scale each section to its complexity —
a simple section can be 2-3 sentences, a complex one can be 200-300 words.
Include wireframes for visual sections.

Required sections (include ALL that apply, skip those that don't):
- architecture: High-level structure, boundaries, dependencies
- components: Key modules/files to create or modify
- data_flow: How data moves through the system
- api: Endpoints, contracts, request/response shapes
- ui: Screens, layouts, interactions (include wireframe)
- error_handling: Failure modes and recovery strategies
- testing: What to test and how

Each section should be self-contained enough to review independently.
Use the selected approach as your foundation. Do not revisit alternatives.
```

### TUI: Section-by-Section Review

```
┌─────────────────────────────────────────────────────────────────────┐
│  Design: <title>                                                    │
│  Section 1/N: <section title>                                       │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  <rendered markdown content>                                        │
│  <optional wireframe with colors>                                   │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│  [Enter] ✓ Approve    [R] ✎ Request changes    [Esc] abort         │
└─────────────────────────────────────────────────────────────────────┘
```

### brainstorm_design_revision Tool (for [R] changes)

```typescript
{
  name: "brainstorm_design_revision",
  parameters: Type.Object({
    section_id: Type.String(),
    content: Type.String(),
    wireframe: Type.Optional(Type.Object({
      description: Type.String(),
      lines: Type.Array(Type.String()),
    })),
  }),
  terminate: true
}
```

Model for revisions: **sonnet** (targeted fix, not full synthesis).

---

## Step 6: Write Spec (Deterministic)

### Spec Template

```markdown
# Design: {title}

**Date:** {YYYY-MM-DD}
**Approach:** {selected approach title}

## Assumptions

- {assumption 1 text} (confidence: high)
- {assumption 2 text} (confidence: medium)

## Context & Decisions

| Question | Answer | Reasoning |
|----------|--------|-----------|
| {label}  | {value} | {reasoning} |

## {section.title}

{section.content}

...
```

### File Location

```typescript
function specPath(cwd: string, title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return path.join(cwd, "docs", "superpowers", "specs", `${date}-${slug}-design.md`);
}
```

User preference for location overrides this default.

---

## Step 7: Self-Review (LLM: opus)

### brainstorm_review Tool Schema

```typescript
{
  name: "brainstorm_review",
  parameters: Type.Object({
    status: StringEnum(["pass", "issues_found"]),
    issues: Type.Array(Type.Object({
      id: Type.String(),
      section: Type.String(),
      severity: StringEnum(["high", "medium", "low"]),
      type: StringEnum(["contradiction", "ambiguity", "placeholder", "gap", "scope_creep"]),
      description: Type.String(),
      suggestion: Type.String(),
    })),
    summary: Type.String(),
  }),
  terminate: true
}
```

### System Prompt (Step 7)

```
You are a senior architect performing a critical review of a design spec.
Your job is to find REAL problems, not nitpick style.

Look for:
1. CONTRADICTIONS: Section A says X, section B says not-X
2. AMBIGUITY: A requirement that could be interpreted 2+ ways
3. PLACEHOLDERS: TBD, TODO, "will be defined later", vague hand-waving
4. GAPS: Important failure modes not covered, missing integration points
5. SCOPE CREEP: Things that weren't in the original requirements sneaking in

Do NOT flag:
- Style preferences
- Alternative approaches (that's already decided)
- Minor wording issues

If the spec is solid, return status: "pass". Don't invent issues.
```

### Flow

```
opus reviews → pass? → advance to step 8
             → issues? → auto-fix (sonnet) → re-review (opus)
                          → still unresolved? (rare)
                             → present to user (same TUI as step 5)
                             → user provides guidance
                             → sonnet applies fix
                             → advance to step 8
```

### TUI: Issues Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  Self-review: N high, M medium issues                               │
│  ↑↓ navigate • enter view • A auto-fix all • Esc skip              │
│                                                                     │
│  🔴 [high] <section> — <type>                                       │
│     <description>                                                   │
│                                                                     │
│  🟡 [medium] <section> — <type>                                      │
│     <description>                                                   │
│                                                                     │
│  [A] Auto-fix all    [Enter] View suggestion    [Esc] Skip review   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 8: User Reviews Spec (Deterministic)

### TUI

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Spec ready                                                       │
│  <spec file path>                                                   │
│                                                                     │
│  Review the file, then:                                             │
│  [Enter] ✓ Approve    [R] ✎ Request changes    [Esc] abort         │
└─────────────────────────────────────────────────────────────────────┘
```

- **Enter:** Brainstorming complete. Notify and deactivate workflow.
- **R:** Open text input → LLM (sonnet) applies change → rewrite spec → re-confirm.
- **Esc:** Abort.

### Completion Message

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Brainstorming complete                                           │
│  Spec: <path>                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Model Routing

| Step | Model | Reasoning |
|---|---|---|
| 3 (research + questions) | sonnet | Structured output + tool calls |
| 3 (challenge re-iteration) | sonnet | Targeted adjustment |
| 4 (propose approaches) | sonnet | Synthesis bounded by research |
| 5 (generate design) | **opus** | Full synthesis, multiple constraints |
| 5 (section revision) | sonnet | Targeted fix |
| 7 (self-review) | **opus** | Critical analysis, contradiction detection |
| 7 (auto-fix) | sonnet | Applying known fixes |
| 8 (request changes) | sonnet | Targeted adjustment |

### Implementation

```typescript
// Before opus steps:
const originalModel = ctx.modelRegistry.find(currentProvider, currentModelId);
const opusModel = ctx.modelRegistry.find("github-copilot", "claude-opus-4.6");
await pi.setModel(opusModel);

// After opus step completes:
await pi.setModel(originalModel);
```

---

## State Persistence

```typescript
interface BrainstormState {
  phase: Phase;
  originalPrompt: string;
  compressedContext: string;
  assumptions: Assumption[];
  questions: Question[];
  answers: Record<string, string>;
  researchResults: string;
  approaches: Approach[];
  selectedApproach: string | null;
  design: Design | null;
  specPath: string | null;
  reviewResult: ReviewResult | null;
  originalModel: { provider: string; id: string } | null;
}

// Persisted via:
pi.appendEntry("brainstorm-state", state);

// Restored on session_start:
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "brainstorm-state") {
      state = entry.data as BrainstormState;
    }
  }
});
```

---

## Extension Structure

```
~/.pi/agent/extensions/brainstorm-workflow/
├── package.json
├── index.ts                 # Extension entry: event handlers + state machine
├── state.ts                 # State types + persistence
├── steps/
│   ├── gather-context.ts    # Step 1: deterministic exploration
│   ├── questions.ts         # Step 3: TUI form rendering
│   ├── approaches.ts        # Step 4: TUI approach selector
│   ├── design-review.ts     # Step 5: section-by-section TUI
│   ├── write-spec.ts        # Step 6: assemble + write markdown
│   ├── self-review.ts       # Step 7: issues display TUI
│   └── user-review.ts       # Step 8: final confirmation TUI
├── tools/
│   ├── brainstorm-questions.ts
│   ├── brainstorm-approaches.ts
│   ├── brainstorm-design.ts
│   ├── brainstorm-design-revision.ts
│   └── brainstorm-review.ts
├── lib/
│   ├── compress.ts          # Context compression functions
│   ├── wireframe.ts         # {{color}} tag → theme.fg() renderer
│   └── prompts.ts           # System prompts per step
└── types.ts                 # Shared interfaces
```

---

## Dependencies

```json
{
  "name": "pi-brainstorm-workflow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "0.75.4",
    "@earendil-works/pi-tui": "0.75.4"
  }
}
```

---

## Token Budget Summary

| Step | Model | Input | Output | Total |
|---|---|---|---|---|
| 1. Exploration | — | 0 | 0 | 0 |
| 3. Research + questions | sonnet | ~20,300 | ~1,000 | ~21,300 |
| 4. Approaches | sonnet | ~5,000 | ~1,500 | ~6,500 |
| 5. Design | opus | ~5,500 | ~3,000 | ~8,500 |
| 7. Self-review | opus | ~5,000 | ~800 | ~5,800 |
| **Typical total** | | **~36,000** | **~6,300** | **~42,000** |

Versus current SKILL.md: ~262,000 tokens. **Savings: ~84%.**
