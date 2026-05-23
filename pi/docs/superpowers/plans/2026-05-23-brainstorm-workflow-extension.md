# Brainstorm Workflow Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pi extension that converts the brainstorming skill into a state-machine-driven workflow — handling deterministic steps inline (0 tokens) and delegating creative steps to the LLM with focused prompts and model routing.

**Architecture:** The extension intercepts user input containing `--brainstorm`, runs a state machine that alternates between deterministic phases (context gathering, TUI forms, spec writing) and LLM phases (research, design, review). LLM phases use terminating tools (`terminate: true`) to hand control back to the extension after each structured output. Model routing switches between sonnet (research, targeted fixes) and opus (full design synthesis, critical review).

**Tech Stack:** TypeScript, Bun (package management + tests), pi extension API (`@earendil-works/pi-coding-agent`), pi TUI (`@earendil-works/pi-tui`), `typebox` for schemas, `@earendil-works/pi-ai` for `StringEnum`.

---

## File Structure

```
~/.pi/agent/extensions/brainstorm-workflow/
├── package.json              # Bun project, pi extension entry
├── index.ts                  # Extension entry: event handlers + state machine orchestrator
├── state.ts                  # State types, persistence, transitions
├── types.ts                  # Shared interfaces (Assumption, Question, Approach, etc.)
├── steps/
│   ├── gather-context.ts     # Step 1: deterministic exploration + compression
│   ├── questions.ts          # Step 3: TUI SettingsList form rendering
│   ├── approaches.ts         # Step 4: TUI approach selector
│   ├── design-review.ts      # Step 5: section-by-section TUI
│   ├── write-spec.ts         # Step 6: assemble + write markdown
│   ├── self-review.ts        # Step 7: issues display TUI
│   └── user-review.ts        # Step 8: final confirmation TUI
├── tools/
│   ├── brainstorm-questions.ts
│   ├── brainstorm-approaches.ts
│   ├── brainstorm-design.ts
│   ├── brainstorm-design-revision.ts
│   └── brainstorm-review.ts
├── lib/
│   ├── compress.ts           # Context compression functions
│   ├── wireframe.ts          # {{color}} tag → theme.fg() renderer
│   └── prompts.ts            # System prompts per step
└── tests/
    ├── compress.test.ts      # Unit tests for compression
    ├── wireframe.test.ts     # Unit tests for wireframe rendering
    ├── state.test.ts         # Unit tests for state transitions
    └── write-spec.test.ts    # Unit tests for spec assembly
```

---

## Task 1: Scaffold Extension and Dependencies

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/package.json`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pi-brainstorm-workflow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun install`
Expected: `node_modules` created, lockfile generated.

- [ ] **Step 2: Create types.ts with shared interfaces**

```typescript
// types.ts — Shared interfaces for the brainstorm workflow

export type Phase =
  | "IDLE"
  | "GATHERING_CONTEXT"
  | "RESEARCHING_AND_QUESTIONING"
  | "FORM_INTERACTION"
  | "PROPOSING_APPROACHES"
  | "APPROACH_SELECTION"
  | "GENERATING_DESIGN"
  | "DESIGN_REVIEW"
  | "WRITING_SPEC"
  | "SELF_REVIEW"
  | "USER_REVIEW"
  | "COMPLETE";

export interface Assumption {
  id: string;
  text: string;
  confidence: "high" | "medium" | "low";
}

export interface Question {
  id: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  default: string;
  reasoning: string;
}

export interface Wireframe {
  description: string;
  lines: string[];
}

export interface Approach {
  id: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  wireframe?: Wireframe;
}

export interface DesignSection {
  id: string;
  title: string;
  content: string;
  wireframe?: Wireframe;
}

export interface ReviewIssue {
  id: string;
  section: string;
  severity: "high" | "medium" | "low";
  type: "contradiction" | "ambiguity" | "placeholder" | "gap" | "scope_creep";
  description: string;
  suggestion: string;
}

export interface ReviewResult {
  status: "pass" | "issues_found";
  issues: ReviewIssue[];
  summary: string;
}
```

- [ ] **Step 3: Verify structure**

Run: `eza --tree --level=1 ~/.pi/agent/extensions/brainstorm-workflow`
Expected: Shows `package.json`, `types.ts`, `node_modules/`, `bun.lock`

- [ ] **Step 4: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git init
git add package.json bun.lock types.ts
git commit -m "feat: scaffold brainstorm-workflow extension"
```

---

## Task 2: State Management

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/state.ts`
- Test: `~/.pi/agent/extensions/brainstorm-workflow/tests/state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/state.test.ts
import { describe, expect, test } from "bun:test";
import { BrainstormState, createInitialState, transition } from "../state.ts";

describe("BrainstormState", () => {
  test("createInitialState returns IDLE phase", () => {
    const state = createInitialState();
    expect(state.phase).toBe("IDLE");
    expect(state.originalPrompt).toBe("");
  });

  test("transition from IDLE to GATHERING_CONTEXT sets prompt", () => {
    const state = createInitialState();
    const next = transition(state, "START", { prompt: "build an auth module" });
    expect(next.phase).toBe("GATHERING_CONTEXT");
    expect(next.originalPrompt).toBe("build an auth module");
  });

  test("transition from GATHERING_CONTEXT to RESEARCHING sets context", () => {
    const state: BrainstormState = {
      ...createInitialState(),
      phase: "GATHERING_CONTEXT",
      originalPrompt: "build auth",
    };
    const next = transition(state, "CONTEXT_GATHERED", {
      compressedContext: "project: my-app\ndeps: react, next",
    });
    expect(next.phase).toBe("RESEARCHING_AND_QUESTIONING");
    expect(next.compressedContext).toBe("project: my-app\ndeps: react, next");
  });

  test("invalid transition returns same state", () => {
    const state = createInitialState();
    const next = transition(state, "CONTEXT_GATHERED", { compressedContext: "" });
    expect(next).toBe(state);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/state.test.ts`
Expected: FAIL — module `../state.ts` not found.

- [ ] **Step 3: Implement state.ts**

```typescript
// state.ts — State types, persistence helpers, and transitions
import type {
  Approach,
  Assumption,
  DesignSection,
  Phase,
  Question,
  ReviewResult,
} from "./types.ts";

export interface BrainstormState {
  phase: Phase;
  originalPrompt: string;
  compressedContext: string;
  assumptions: Assumption[];
  questions: Question[];
  answers: Record<string, string>;
  researchResults: string;
  approaches: Approach[];
  selectedApproach: string | null;
  design: { title: string; sections: DesignSection[] } | null;
  specPath: string | null;
  reviewResult: ReviewResult | null;
  originalModel: { provider: string; id: string } | null;
}

export function createInitialState(): BrainstormState {
  return {
    phase: "IDLE",
    originalPrompt: "",
    compressedContext: "",
    assumptions: [],
    questions: [],
    answers: {},
    researchResults: "",
    approaches: [],
    selectedApproach: null,
    design: null,
    specPath: null,
    reviewResult: null,
    originalModel: null,
  };
}

type TransitionAction =
  | { type: "START"; prompt: string }
  | { type: "CONTEXT_GATHERED"; compressedContext: string }
  | { type: "QUESTIONS_RECEIVED"; assumptions: Assumption[]; questions: Question[] }
  | { type: "FORM_CONFIRMED"; answers: Record<string, string>; done: boolean }
  | { type: "APPROACHES_RECEIVED"; approaches: Approach[]; recommendation: string }
  | { type: "APPROACH_SELECTED"; approachId: string }
  | { type: "DESIGN_RECEIVED"; title: string; sections: DesignSection[] }
  | { type: "DESIGN_APPROVED" }
  | { type: "SPEC_WRITTEN"; specPath: string }
  | { type: "REVIEW_RECEIVED"; result: ReviewResult }
  | { type: "USER_APPROVED" }
  | { type: "RESET" };

export function transition(
  state: BrainstormState,
  actionType: TransitionAction["type"],
  payload?: Omit<TransitionAction & { type: typeof actionType }, "type"> extends infer P
    ? P extends Record<string, never>
      ? undefined
      : P
    : undefined,
): BrainstormState {
  const action = { type: actionType, ...payload } as TransitionAction;

  switch (action.type) {
    case "START":
      if (state.phase !== "IDLE") return state;
      return { ...state, phase: "GATHERING_CONTEXT", originalPrompt: action.prompt };

    case "CONTEXT_GATHERED":
      if (state.phase !== "GATHERING_CONTEXT") return state;
      return { ...state, phase: "RESEARCHING_AND_QUESTIONING", compressedContext: action.compressedContext };

    case "QUESTIONS_RECEIVED":
      if (state.phase !== "RESEARCHING_AND_QUESTIONING") return state;
      return {
        ...state,
        phase: "FORM_INTERACTION",
        assumptions: action.assumptions,
        questions: action.questions,
      };

    case "FORM_CONFIRMED":
      if (state.phase !== "FORM_INTERACTION") return state;
      if (action.done) {
        return { ...state, phase: "PROPOSING_APPROACHES", answers: action.answers };
      }
      return { ...state, phase: "RESEARCHING_AND_QUESTIONING", answers: action.answers };

    case "APPROACHES_RECEIVED":
      if (state.phase !== "PROPOSING_APPROACHES") return state;
      return { ...state, phase: "APPROACH_SELECTION", approaches: action.approaches };

    case "APPROACH_SELECTED":
      if (state.phase !== "APPROACH_SELECTION") return state;
      return { ...state, phase: "GENERATING_DESIGN", selectedApproach: action.approachId };

    case "DESIGN_RECEIVED":
      if (state.phase !== "GENERATING_DESIGN") return state;
      return {
        ...state,
        phase: "DESIGN_REVIEW",
        design: { title: action.title, sections: action.sections },
      };

    case "DESIGN_APPROVED":
      if (state.phase !== "DESIGN_REVIEW") return state;
      return { ...state, phase: "WRITING_SPEC" };

    case "SPEC_WRITTEN":
      if (state.phase !== "WRITING_SPEC") return state;
      return { ...state, phase: "SELF_REVIEW", specPath: action.specPath };

    case "REVIEW_RECEIVED":
      if (state.phase !== "SELF_REVIEW") return state;
      if (action.result.status === "pass") {
        return { ...state, phase: "USER_REVIEW", reviewResult: action.result };
      }
      return { ...state, reviewResult: action.result };

    case "USER_APPROVED":
      if (state.phase !== "USER_REVIEW") return state;
      return { ...state, phase: "COMPLETE" };

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/state.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add state.ts tests/state.test.ts
git commit -m "feat: add state management with transitions"
```

---

## Task 3: Context Compression Utilities

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/lib/compress.ts`
- Test: `~/.pi/agent/extensions/brainstorm-workflow/tests/compress.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compress.test.ts
import { describe, expect, test } from "bun:test";
import { compressTree, compressPackageJson, compressConfig } from "../lib/compress.ts";

describe("compressTree", () => {
  test("filters out node_modules, .git, dist, build", () => {
    const tree = `src
├── index.ts
├── utils.ts
node_modules
├── react
│   └── index.js
.git
├── config
dist
├── bundle.js
build
├── output.js
__pycache__
├── mod.cpython-39.pyc`;

    const result = compressTree(tree);
    expect(result).toContain("src");
    expect(result).toContain("index.ts");
    expect(result).not.toContain("node_modules");
    expect(result).not.toContain(".git");
    expect(result).not.toContain("dist");
    expect(result).not.toContain("build");
    expect(result).not.toContain("__pycache__");
  });
});

describe("compressPackageJson", () => {
  test("extracts name, dep keys, script keys", () => {
    const pkg = JSON.stringify({
      name: "my-app",
      version: "1.0.0",
      description: "A long description that should be omitted",
      dependencies: { react: "^18.0.0", next: "^14.0.0" },
      devDependencies: { typescript: "^5.0.0", jest: "^29.0.0" },
      scripts: { dev: "next dev", build: "next build", test: "jest" },
    });

    const result = compressPackageJson(pkg);
    expect(result).toContain("my-app");
    expect(result).toContain("react");
    expect(result).toContain("next");
    expect(result).toContain("typescript");
    expect(result).toContain("dev");
    expect(result).toContain("build");
    expect(result).not.toContain("A long description");
    expect(result).not.toContain("^18.0.0");
  });
});

describe("compressConfig", () => {
  test("extracts project name and dependency list from Cargo.toml", () => {
    const toml = `[package]
name = "my-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }`;

    const result = compressConfig("Cargo.toml", toml);
    expect(result).toContain("my-crate");
    expect(result).toContain("serde");
    expect(result).toContain("tokio");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/compress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement lib/compress.ts**

```typescript
// lib/compress.ts — Context compression functions

const FILTERED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  "target/debug",
  "target/release",
  ".turbo",
  ".cache",
  "coverage",
]);

export function compressTree(tree: string): string {
  const lines = tree.split("\n");
  const result: string[] = [];
  let skipDepth = -1;

  for (const line of lines) {
    const trimmed = line.replace(/[├└│─\s│]/g, "").trim();
    const depth = line.search(/\S/);

    // If we're skipping a subtree and this line is deeper, skip it
    if (skipDepth >= 0 && depth > skipDepth) continue;
    skipDepth = -1;

    // Check if this directory name should be filtered
    const dirName = trimmed.replace(/[/\\]$/, "");
    if (FILTERED_DIRS.has(dirName)) {
      skipDepth = depth;
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

export function compressPackageJson(content: string): string {
  try {
    const pkg = JSON.parse(content);
    const parts: string[] = [];

    if (pkg.name) parts.push(`name: ${pkg.name}`);
    if (pkg.dependencies) {
      parts.push(`deps: ${Object.keys(pkg.dependencies).join(", ")}`);
    }
    if (pkg.devDependencies) {
      parts.push(`devDeps: ${Object.keys(pkg.devDependencies).join(", ")}`);
    }
    if (pkg.scripts) {
      parts.push(`scripts: ${Object.keys(pkg.scripts).join(", ")}`);
    }

    return parts.join("\n");
  } catch {
    return content.slice(0, 200);
  }
}

export function compressConfig(filename: string, content: string): string {
  const parts: string[] = [`[${filename}]`];

  // Extract name
  const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
  if (nameMatch) parts.push(`name: ${nameMatch[1]}`);

  // Extract dependencies section
  const depsSection = content.match(
    /\[(?:dependencies|tool\.poetry\.dependencies|project\.dependencies)\]([\s\S]*?)(?=\n\[|$)/,
  );
  if (depsSection) {
    const depLines = depsSection[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("["));
    const depNames = depLines
      .map((l) => l.split(/\s*[=:{]/)[0].trim())
      .filter(Boolean);
    if (depNames.length > 0) {
      parts.push(`deps: ${depNames.join(", ")}`);
    }
  }

  return parts.join("\n");
}

export function assembleCompressedContext(
  tree: string,
  configs: Array<{ filename: string; content: string }>,
  graphifyExists: boolean,
): string {
  const sections: string[] = [];

  if (tree) {
    sections.push(`## Project Structure\n${compressTree(tree)}`);
  }

  for (const cfg of configs) {
    if (cfg.filename === "package.json") {
      sections.push(`## ${cfg.filename}\n${compressPackageJson(cfg.content)}`);
    } else {
      sections.push(`## ${cfg.filename}\n${compressConfig(cfg.filename, cfg.content)}`);
    }
  }

  if (graphifyExists) {
    sections.push("## Knowledge Graph\ngraphify-out/ exists — can query codebase graph.");
  }

  const assembled = sections.join("\n\n");
  // Hard cap at ~2000 tokens (~8000 chars)
  if (assembled.length > 8000) {
    return assembled.slice(0, 8000) + "\n\n[context truncated]";
  }
  return assembled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/compress.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add lib/compress.ts tests/compress.test.ts
git commit -m "feat: add context compression utilities"
```

---

## Task 4: Wireframe Renderer

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/lib/wireframe.ts`
- Test: `~/.pi/agent/extensions/brainstorm-workflow/tests/wireframe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/wireframe.test.ts
import { describe, expect, test } from "bun:test";
import { renderWireframe } from "../lib/wireframe.ts";

describe("renderWireframe", () => {
  test("replaces color tags with theme calls", () => {
    const lines = [
      "{{accent}}Header{{/accent}}",
      "{{muted}}Some muted text{{/muted}}",
      "Plain text no tags",
    ];

    // Mock theme
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("[accent:Header]");
    expect(result[1]).toBe("[muted:Some muted text]");
    expect(result[2]).toBe("Plain text no tags");
  });

  test("handles bold tag", () => {
    const lines = ["{{bold}}Title{{/bold}}"];
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("<b>Title</b>");
  });

  test("handles multiple tags in one line", () => {
    const lines = ["{{accent}}Name{{/accent}} - {{muted}}desc{{/muted}}"];
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `<b>${text}</b>`,
    };

    const result = renderWireframe(lines, theme as any);
    expect(result[0]).toBe("[accent:Name] - [muted:desc]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/wireframe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement lib/wireframe.ts**

```typescript
// lib/wireframe.ts — {{color}} tag → theme.fg() renderer

interface ThemeLike {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

const COLOR_TAGS = ["accent", "success", "warning", "error", "muted", "dim"] as const;

export function renderWireframe(lines: string[], theme: ThemeLike): string[] {
  return lines.map((line) => renderWireframeLine(line, theme));
}

function renderWireframeLine(line: string, theme: ThemeLike): string {
  let result = line;

  // Handle bold tag
  result = result.replace(/\{\{bold\}\}(.*?)\{\{\/bold\}\}/g, (_match, text) => {
    return theme.bold(text);
  });

  // Handle color tags
  for (const color of COLOR_TAGS) {
    const regex = new RegExp(`\\{\\{${color}\\}\\}(.*?)\\{\\{\\/${color}\\}\\}`, "g");
    result = result.replace(regex, (_match, text) => {
      return theme.fg(color, text);
    });
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/wireframe.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add lib/wireframe.ts tests/wireframe.test.ts
git commit -m "feat: add wireframe color tag renderer"
```

---

## Task 5: System Prompts

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/lib/prompts.ts`

- [ ] **Step 1: Create lib/prompts.ts**

```typescript
// lib/prompts.ts — System prompts for each LLM step

export function getResearchPrompt(
  compressedContext: string,
  originalPrompt: string,
  previousAnswers?: Record<string, string>,
): string {
  const answersSection = previousAnswers && Object.keys(previousAnswers).length > 0
    ? `\nPrevious answers from user:\n${Object.entries(previousAnswers)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}\n`
    : "";

  return `You are a senior software architect doing pre-design research.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}
${answersSection}
PHASE 1 - RESEARCH:
Research best practices for the user's request using the available tools:
- Use bash to run ctx7 commands for library documentation detected in the project
- Use bash to run ddg for general best practices, market standards, proven patterns
- Use bash for ddg as fallback when ctx7 doesn't have sufficient info
- If the context mentions graphify-out exists, use bash to query the knowledge graph

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
If they need to change something, it means your research missed something.`;
}

export function getApproachesPrompt(
  compressedContext: string,
  originalPrompt: string,
  assumptions: string,
  answers: string,
): string {
  return `You are a senior software architect proposing design approaches.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}

VALIDATED ASSUMPTIONS:
${assumptions}

USER DECISIONS:
${answers}

Generate 2-3 approaches with clear tradeoffs. Call brainstorm_approaches with:
- Each approach: title, summary (2-3 sentences), pros, cons, effort, risk
- Your recommendation with detailed reasoning
- Optional wireframe (ONLY for visual decisions: UI layout, screen flow)

WIREFRAME RULES (when applicable):
- Use box-drawing characters (┌─┐│└┘) for structure
- Use {{color}} tags for semantic meaning: {{accent}}, {{success}}, {{warning}}, {{error}}, {{muted}}, {{dim}}, {{bold}}
- Keep under 20 lines — convey layout, not pixel-perfect design
- Only include when the approach involves a VISUAL decision`;
}

export function getDesignPrompt(
  compressedContext: string,
  originalPrompt: string,
  selectedApproach: string,
  assumptions: string,
  answers: string,
): string {
  return `You are a senior software architect producing a complete design.

PROJECT CONTEXT:
${compressedContext}

USER REQUEST:
${originalPrompt}

VALIDATED ASSUMPTIONS:
${assumptions}

USER DECISIONS:
${answers}

SELECTED APPROACH:
${selectedApproach}

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

Call brainstorm_design with your complete design.`;
}

export function getRevisionPrompt(
  sectionContent: string,
  userFeedback: string,
): string {
  return `You are a senior software architect revising a section of a design spec.

CURRENT SECTION:
${sectionContent}

USER FEEDBACK:
${userFeedback}

Revise the section to address the feedback. Keep everything that wasn't criticized.
Call brainstorm_design_revision with the updated section.`;
}

export function getReviewPrompt(specContent: string): string {
  return `You are a senior architect performing a critical review of a design spec.
Your job is to find REAL problems, not nitpick style.

SPEC TO REVIEW:
${specContent}

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
Call brainstorm_review with your findings.`;
}

export function getAutoFixPrompt(
  specContent: string,
  issues: string,
): string {
  return `You are a senior architect fixing identified issues in a design spec.

SPEC:
${specContent}

ISSUES TO FIX:
${issues}

Apply the suggested fixes. For each issue, make the minimal change needed.
Call brainstorm_design with the complete updated design (all sections, not just fixed ones).`;
}
```

- [ ] **Step 2: Verify file is syntactically valid**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build lib/prompts.ts --no-bundle 2>&1 | head -5`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add lib/prompts.ts
git commit -m "feat: add system prompts for each LLM step"
```

---

## Task 6: Gather Context Step (Deterministic)

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/gather-context.ts`

- [ ] **Step 1: Implement steps/gather-context.ts**

```typescript
// steps/gather-context.ts — Step 1: deterministic exploration + compression
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { assembleCompressedContext } from "../lib/compress.ts";

const CONFIG_PATTERNS = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "turbo.json",
  "mise.toml",
  "composer.json",
  "Gemfile",
  "go.mod",
  "deno.json",
  "tsconfig.json",
  "angular.json",
  "nx.json",
];

const CONFIG_REGEX = new RegExp(
  `(${CONFIG_PATTERNS.map((p) => p.replace(".", "\\.")).join("|")})$`,
);

export async function gatherContext(
  pi: ExtensionAPI,
  cwd: string,
  signal?: AbortSignal,
): Promise<string> {
  // 1. Project tree (depth 5, filtered)
  const treeResult = await pi.exec("eza", ["--tree", "--level=5", "."], {
    signal,
    timeout: 10000,
  });
  const tree = treeResult.code === 0 ? treeResult.stdout : "";

  // 2. Detect config files
  const configResult = await pi.exec(
    "rg",
    ["--files", "--glob", `{${CONFIG_PATTERNS.join(",")}}`, "."],
    { signal, timeout: 5000 },
  );
  const configFiles = configResult.code === 0
    ? configResult.stdout.split("\n").filter((l) => l.trim() && CONFIG_REGEX.test(l))
    : [];

  // 3. Read each config
  const configs: Array<{ filename: string; content: string }> = [];
  for (const file of configFiles.slice(0, 10)) {
    const readResult = await pi.exec("cat", [file], { signal, timeout: 3000 });
    if (readResult.code === 0) {
      const filename = file.split("/").pop() || file;
      configs.push({ filename, content: readResult.stdout });
    }
  }

  // 4. Check graphify-out
  const graphifyResult = await pi.exec("test", ["-d", "graphify-out"], {
    signal,
    timeout: 2000,
  });
  const graphifyExists = graphifyResult.code === 0;

  // 5. Assemble compressed context
  return assembleCompressedContext(tree, configs, graphifyExists);
}
```

- [ ] **Step 2: Verify file syntax**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build steps/gather-context.ts --no-bundle 2>&1 | head -5`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/gather-context.ts
git commit -m "feat: add deterministic context gathering step"
```

---

## Task 7: Terminating Tools (All 5)

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/tools/brainstorm-questions.ts`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/tools/brainstorm-approaches.ts`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/tools/brainstorm-design.ts`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/tools/brainstorm-design-revision.ts`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/tools/brainstorm-review.ts`

- [ ] **Step 1: Create tools/brainstorm-questions.ts**

```typescript
// tools/brainstorm-questions.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormQuestions(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_questions",
    label: "Brainstorm Questions",
    description:
      "Deliver structured research findings: assumptions inferred from context and strategic questions for the user. Set done=true when enough info gathered to propose approaches.",
    parameters: Type.Object({
      done: Type.Boolean({ description: "True if enough info to propose approaches" }),
      assumptions: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            text: Type.String(),
            confidence: StringEnum(["high", "medium", "low"] as const),
          }),
        ),
      ),
      questions: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            label: Type.String(),
            type: StringEnum(["select", "text"] as const),
            options: Type.Optional(Type.Array(Type.String())),
            default: Type.String(),
            reasoning: Type.String(),
          }),
        ),
      ),
    }),
    async execute(_toolCallId, params) {
      const assumptionCount = params.assumptions?.length ?? 0;
      const questionCount = params.questions?.length ?? 0;
      return {
        content: [
          {
            type: "text" as const,
            text: `Delivered ${assumptionCount} assumptions and ${questionCount} questions. Done: ${params.done}`,
          },
        ],
        details: {
          done: params.done,
          assumptions: params.assumptions ?? [],
          questions: params.questions ?? [],
        },
        terminate: true,
      };
    },
  });
}
```

- [ ] **Step 2: Create tools/brainstorm-approaches.ts**

```typescript
// tools/brainstorm-approaches.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormApproaches(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_approaches",
    label: "Brainstorm Approaches",
    description:
      "Deliver 2-3 design approaches with tradeoffs, effort/risk assessment, optional wireframes, and a recommendation.",
    parameters: Type.Object({
      approaches: Type.Array(
        Type.Object({
          id: Type.String(),
          title: Type.String(),
          summary: Type.String(),
          pros: Type.Array(Type.String()),
          cons: Type.Array(Type.String()),
          effort: StringEnum(["low", "medium", "high"] as const),
          risk: StringEnum(["low", "medium", "high"] as const),
          wireframe: Type.Optional(
            Type.Object({
              description: Type.String(),
              lines: Type.Array(Type.String()),
            }),
          ),
        }),
      ),
      recommendation: Type.String(),
      recommendation_reasoning: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const count = params.approaches.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Proposed ${count} approaches. Recommended: ${params.recommendation}`,
          },
        ],
        details: {
          approaches: params.approaches,
          recommendation: params.recommendation,
          recommendation_reasoning: params.recommendation_reasoning,
        },
        terminate: true,
      };
    },
  });
}
```

- [ ] **Step 3: Create tools/brainstorm-design.ts**

```typescript
// tools/brainstorm-design.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormDesign(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_design",
    label: "Brainstorm Design",
    description:
      "Deliver a complete design structured in reviewable sections. Each section is self-contained.",
    parameters: Type.Object({
      title: Type.String({ description: "Design title" }),
      sections: Type.Array(
        Type.Object({
          id: Type.String(),
          title: Type.String(),
          content: Type.String({ description: "Section content in markdown" }),
          wireframe: Type.Optional(
            Type.Object({
              description: Type.String(),
              lines: Type.Array(Type.String()),
            }),
          ),
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const sectionCount = params.sections.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Design "${params.title}" with ${sectionCount} sections delivered.`,
          },
        ],
        details: {
          title: params.title,
          sections: params.sections,
        },
        terminate: true,
      };
    },
  });
}
```

- [ ] **Step 4: Create tools/brainstorm-design-revision.ts**

```typescript
// tools/brainstorm-design-revision.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormDesignRevision(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_design_revision",
    label: "Brainstorm Design Revision",
    description: "Deliver a revised section of the design.",
    parameters: Type.Object({
      section_id: Type.String(),
      content: Type.String({ description: "Revised section content in markdown" }),
      wireframe: Type.Optional(
        Type.Object({
          description: Type.String(),
          lines: Type.Array(Type.String()),
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Section "${params.section_id}" revised.`,
          },
        ],
        details: {
          section_id: params.section_id,
          content: params.content,
          wireframe: params.wireframe,
        },
        terminate: true,
      };
    },
  });
}
```

- [ ] **Step 5: Create tools/brainstorm-review.ts**

```typescript
// tools/brainstorm-review.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormReview(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_review",
    label: "Brainstorm Review",
    description: "Deliver critical review findings of a design spec.",
    parameters: Type.Object({
      status: StringEnum(["pass", "issues_found"] as const),
      issues: Type.Array(
        Type.Object({
          id: Type.String(),
          section: Type.String(),
          severity: StringEnum(["high", "medium", "low"] as const),
          type: StringEnum([
            "contradiction",
            "ambiguity",
            "placeholder",
            "gap",
            "scope_creep",
          ] as const),
          description: Type.String(),
          suggestion: Type.String(),
        }),
      ),
      summary: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const issueCount = params.issues.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Review: ${params.status}. ${issueCount} issues found.`,
          },
        ],
        details: {
          status: params.status,
          issues: params.issues,
          summary: params.summary,
        },
        terminate: true,
      };
    },
  });
}
```

- [ ] **Step 6: Verify all tool files compile**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && for f in tools/*.ts; do echo "--- $f ---"; bun build "$f" --no-bundle 2>&1 | tail -1; done`
Expected: No errors for any file.

- [ ] **Step 7: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add tools/
git commit -m "feat: add all 5 terminating tools for brainstorm workflow"
```

---

## Task 8: TUI — Questions Form (SettingsList)

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/questions.ts`

- [ ] **Step 1: Implement steps/questions.ts**

```typescript
// steps/questions.ts — Step 3 TUI: SettingsList-based form for assumptions + questions
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Spacer, Text } from "@earendil-works/pi-tui";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import type { Assumption, Question } from "../types.ts";

export interface QuestionsFormResult {
  answers: Record<string, string>;
  challengedAssumption?: { id: string; observation: string };
  cancelled: boolean;
  skipped: boolean;
}

export async function showQuestionsForm(
  ctx: ExtensionContext,
  assumptions: Assumption[],
  questions: Question[],
  requestTitle: string,
): Promise<QuestionsFormResult> {
  const answers: Record<string, string> = {};
  // Pre-fill with defaults
  for (const q of questions) {
    answers[q.id] = q.default;
  }

  const result = await ctx.ui.custom<QuestionsFormResult>((tui, theme, _kb, done) => {
    const container = new Container();

    // Title
    container.addChild(
      new Text(theme.fg("accent", theme.bold(`  Brainstorming: ${requestTitle}`)), 0, 0),
    );
    container.addChild(new Text(theme.fg("dim", "  ↑↓ navigate • enter activate • R challenge assumption"), 0, 0));
    container.addChild(new Spacer(1));

    // Build settings items
    const items: SettingItem[] = [];

    // "Confirm all" action at top
    items.push({
      id: "__confirm__",
      label: "▶ Confirm all",
      currentValue: "press enter",
      values: ["press enter"],
    });

    // Separator for assumptions
    if (assumptions.length > 0) {
      items.push({
        id: "__assumptions_header__",
        label: "── Assumptions (R to challenge) ──",
        currentValue: "",
        values: [""],
      });

      for (const a of assumptions) {
        const icon = a.confidence === "high" ? "✓" : "~";
        items.push({
          id: `assumption:${a.id}`,
          label: `${icon} ${a.text}`,
          currentValue: a.confidence,
          values: [a.confidence],
        });
      }
    }

    // Separator for questions
    if (questions.length > 0) {
      items.push({
        id: "__questions_header__",
        label: "── Questions ──",
        currentValue: "",
        values: [""],
      });

      for (const q of questions) {
        const values = q.type === "select" && q.options ? q.options : [q.default];
        items.push({
          id: `question:${q.id}`,
          label: q.label,
          currentValue: q.default,
          values,
        });
      }
    }

    // "Done, skip remaining" at bottom
    items.push({
      id: "__skip__",
      label: "✗ Done, skip remaining",
      currentValue: "esc",
      values: ["esc"],
    });

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      (id, newValue) => {
        if (id === "__confirm__") {
          done({ answers, cancelled: false, skipped: false });
          return;
        }
        if (id === "__skip__") {
          done({ answers, cancelled: false, skipped: true });
          return;
        }
        if (id.startsWith("question:")) {
          const qId = id.replace("question:", "");
          answers[qId] = newValue;
        }
      },
      () => done({ answers, cancelled: true, skipped: false }),
    );

    container.addChild(settingsList);

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        // Handle 'R' for challenging assumptions
        if (data === "r" || data === "R") {
          // Check if currently selected item is an assumption
          // For now, challenge via text input
          const challengePrompt = async () => {
            const observation = await ctx.ui.input(
              "Your observation about this assumption:",
              "",
            );
            if (observation) {
              done({
                answers,
                challengedAssumption: { id: "current", observation },
                cancelled: false,
                skipped: false,
              });
            }
          };
          challengePrompt();
          return;
        }
        settingsList.handleInput?.(data);
        tui.requestRender();
      },
    };
  });

  return result;
}
```

- [ ] **Step 2: Verify syntax**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build steps/questions.ts --no-bundle 2>&1 | head -5`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/questions.ts
git commit -m "feat: add TUI questions form (SettingsList)"
```

---

## Task 9: TUI — Approach Selector

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/approaches.ts`

- [ ] **Step 1: Implement steps/approaches.ts**

```typescript
// steps/approaches.ts — Step 4 TUI: approach selector
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text } from "@earendil-works/pi-tui";
import type { Approach } from "../types.ts";
import { renderWireframe } from "../lib/wireframe.ts";

export interface ApproachSelectionResult {
  selectedId: string | null;
  cancelled: boolean;
}

export async function showApproachSelector(
  ctx: ExtensionContext,
  approaches: Approach[],
  recommendation: string,
  recommendationReasoning: string,
): Promise<ApproachSelectionResult> {
  const items: SelectItem[] = approaches.map((a, i) => {
    const isRecommended = a.id === recommendation;
    const prefix = isRecommended ? "★ " : "  ";
    const letter = String.fromCharCode(65 + i); // A, B, C
    return {
      value: a.id,
      label: `${prefix}${letter}. ${a.title}`,
      description: `effort: ${a.effort} • risk: ${a.risk}`,
    };
  });

  const result = await ctx.ui.custom<ApproachSelectionResult>((tui, theme, _kb, done) => {
    const container = new Container();

    // Top border
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    // Title
    container.addChild(new Text(theme.fg("accent", theme.bold("  Approaches")), 0, 0));
    container.addChild(
      new Text(theme.fg("dim", "  ↑↓ navigate • enter select • V view details • esc abort"), 0, 0),
    );
    container.addChild(new Spacer(1));

    // SelectList
    const selectList = new SelectList(items, Math.min(items.length, 10), {
      selectedPrefix: (t: string) => theme.fg("accent", t),
      selectedText: (t: string) => theme.fg("accent", t),
      description: (t: string) => theme.fg("muted", t),
      scrollInfo: (t: string) => theme.fg("dim", t),
      noMatch: (t: string) => theme.fg("warning", t),
    });
    selectList.onSelect = (item) => done({ selectedId: item.value, cancelled: false });
    selectList.onCancel = () => done({ selectedId: null, cancelled: true });
    container.addChild(selectList);

    // Recommendation section
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("muted", "  ── Recommendation ──"), 0, 0));
    container.addChild(new Text(theme.fg("text", `  ${recommendationReasoning}`), 0, 0));

    // Bottom border
    container.addChild(new Spacer(1));
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (data === "v" || data === "V") {
          // Show detail view for current selection — use notify for simplicity
          const currentIndex = items.findIndex((i) => i.value === items[0]?.value);
          const approach = approaches[currentIndex >= 0 ? currentIndex : 0];
          if (approach) {
            const pros = approach.pros.map((p) => `  + ${p}`).join("\n");
            const cons = approach.cons.map((c) => `  - ${c}`).join("\n");
            ctx.ui.notify(
              `${approach.title}\n\n${approach.summary}\n\nPros:\n${pros}\n\nCons:\n${cons}`,
              "info",
            );
          }
          return;
        }
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  return result;
}
```

- [ ] **Step 2: Verify syntax**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build steps/approaches.ts --no-bundle 2>&1 | head -5`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/approaches.ts
git commit -m "feat: add TUI approach selector"
```

---

## Task 10: TUI — Design Section Review

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/design-review.ts`

- [ ] **Step 1: Implement steps/design-review.ts**

```typescript
// steps/design-review.ts — Step 5 TUI: section-by-section review
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, Markdown, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { DesignSection } from "../types.ts";
import { renderWireframe } from "../lib/wireframe.ts";

export type SectionAction =
  | { type: "approve" }
  | { type: "request_changes"; feedback: string }
  | { type: "abort" };

export async function showDesignReview(
  ctx: ExtensionContext,
  title: string,
  sections: DesignSection[],
  sectionIndex: number,
): Promise<SectionAction> {
  const section = sections[sectionIndex];
  const mdTheme = getMarkdownTheme();

  const result = await ctx.ui.custom<SectionAction>((tui, theme, _kb, done) => {
    const container = new Container();

    // Header
    container.addChild(
      new Text(
        theme.fg("accent", theme.bold(`  Design: ${title}`)),
        0,
        0,
      ),
    );
    container.addChild(
      new Text(
        theme.fg("muted", `  Section ${sectionIndex + 1}/${sections.length}: ${section.title}`),
        0,
        0,
      ),
    );
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
    container.addChild(new Spacer(1));

    // Section content as markdown
    container.addChild(new Markdown(section.content, 1, 0, mdTheme));

    // Wireframe if present
    if (section.wireframe) {
      container.addChild(new Spacer(1));
      container.addChild(
        new Text(theme.fg("muted", `  [${section.wireframe.description}]`), 0, 0),
      );
      const renderedLines = renderWireframe(section.wireframe.lines, theme);
      for (const line of renderedLines) {
        container.addChild(new Text(`  ${line}`, 0, 0));
      }
    }

    // Footer
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
    container.addChild(
      new Text(
        theme.fg("dim", "  [Enter] ✓ Approve    [R] ✎ Request changes    [Esc] abort"),
        0,
        0,
      ),
    );

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, Key.enter)) {
          done({ type: "approve" });
        } else if (data === "r" || data === "R") {
          // Prompt for feedback
          ctx.ui.input("What changes do you want?", "").then((feedback) => {
            if (feedback) {
              done({ type: "request_changes", feedback });
            }
          });
        } else if (matchesKey(data, Key.escape)) {
          done({ type: "abort" });
        }
      },
    };
  });

  return result;
}
```

- [ ] **Step 2: Verify syntax**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build steps/design-review.ts --no-bundle 2>&1 | head -5`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/design-review.ts
git commit -m "feat: add TUI section-by-section design review"
```

---

## Task 11: Write Spec Step (Deterministic)

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/write-spec.ts`
- Test: `~/.pi/agent/extensions/brainstorm-workflow/tests/write-spec.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/write-spec.test.ts
import { describe, expect, test } from "bun:test";
import { assembleSpec, generateSpecPath } from "../steps/write-spec.ts";

describe("generateSpecPath", () => {
  test("generates slug from title", () => {
    const path = generateSpecPath("/home/user/project", "Auth Module Design");
    expect(path).toContain("auth-module-design");
    expect(path).toContain("docs/superpowers/specs/");
    expect(path).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(path).toEndWith("-design.md");
  });
});

describe("assembleSpec", () => {
  test("produces valid markdown with all sections", () => {
    const spec = assembleSpec({
      title: "Test Design",
      selectedApproach: "Approach A",
      assumptions: [
        { id: "a1", text: "Using React", confidence: "high" },
      ],
      answers: { q1: "REST API" },
      questions: [{ id: "q1", label: "API style", type: "select", options: ["REST", "GraphQL"], default: "REST", reasoning: "Standard" }],
      sections: [
        { id: "arch", title: "Architecture", content: "Modular design" },
      ],
    });

    expect(spec).toContain("# Design: Test Design");
    expect(spec).toContain("Approach A");
    expect(spec).toContain("Using React");
    expect(spec).toContain("API style");
    expect(spec).toContain("REST API");
    expect(spec).toContain("## Architecture");
    expect(spec).toContain("Modular design");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/write-spec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement steps/write-spec.ts**

```typescript
// steps/write-spec.ts — Step 6: assemble + write markdown spec
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Assumption, DesignSection, Question } from "../types.ts";

export interface SpecData {
  title: string;
  selectedApproach: string;
  assumptions: Assumption[];
  answers: Record<string, string>;
  questions: Question[];
  sections: DesignSection[];
}

export function generateSpecPath(cwd: string, title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return join(cwd, "docs", "superpowers", "specs", `${date}-${slug}-design.md`);
}

export function assembleSpec(data: SpecData): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Design: ${data.title}`);
  lines.push("");
  lines.push(`**Date:** ${date}`);
  lines.push(`**Approach:** ${data.selectedApproach}`);
  lines.push("");

  // Assumptions
  if (data.assumptions.length > 0) {
    lines.push("## Assumptions");
    lines.push("");
    for (const a of data.assumptions) {
      lines.push(`- ${a.text} (confidence: ${a.confidence})`);
    }
    lines.push("");
  }

  // Context & Decisions
  if (data.questions.length > 0) {
    lines.push("## Context & Decisions");
    lines.push("");
    lines.push("| Question | Answer | Reasoning |");
    lines.push("|----------|--------|-----------|");
    for (const q of data.questions) {
      const answer = data.answers[q.id] ?? q.default;
      lines.push(`| ${q.label} | ${answer} | ${q.reasoning} |`);
    }
    lines.push("");
  }

  // Design sections
  for (const section of data.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeSpec(cwd: string, data: SpecData): Promise<string> {
  const specPath = generateSpecPath(cwd, data.title);
  const content = assembleSpec(data);

  await mkdir(dirname(specPath), { recursive: true });
  await writeFile(specPath, content, "utf-8");

  return specPath;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test tests/write-spec.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/write-spec.ts tests/write-spec.test.ts
git commit -m "feat: add spec writing step with template"
```

---

## Task 12: TUI — Self-Review and User Review

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/self-review.ts`
- Create: `~/.pi/agent/extensions/brainstorm-workflow/steps/user-review.ts`

- [ ] **Step 1: Implement steps/self-review.ts**

```typescript
// steps/self-review.ts — Step 7 TUI: issues display
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { ReviewIssue } from "../types.ts";

export type ReviewAction =
  | { type: "auto_fix" }
  | { type: "skip" };

export async function showSelfReview(
  ctx: ExtensionContext,
  issues: ReviewIssue[],
  summary: string,
): Promise<ReviewAction> {
  const highCount = issues.filter((i) => i.severity === "high").length;
  const medCount = issues.filter((i) => i.severity === "medium").length;

  const result = await ctx.ui.custom<ReviewAction>((tui, theme, _kb, done) => {
    const container = new Container();

    // Header
    container.addChild(
      new Text(
        theme.fg("accent", theme.bold(`  Self-review: ${highCount} high, ${medCount} medium issues`)),
        0,
        0,
      ),
    );
    container.addChild(
      new Text(theme.fg("dim", "  ↑↓ navigate • A auto-fix all • Esc skip"), 0, 0),
    );
    container.addChild(new Spacer(1));

    // Issues list
    for (const issue of issues) {
      const icon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "⚪";
      container.addChild(
        new Text(
          `  ${icon} ${theme.fg(issue.severity === "high" ? "error" : "warning", `[${issue.severity}]`)} ${theme.fg("muted", issue.section)} — ${theme.fg("text", issue.type)}`,
          0,
          0,
        ),
      );
      container.addChild(
        new Text(theme.fg("dim", `     ${issue.description}`), 0, 0),
      );
      container.addChild(new Spacer(1));
    }

    // Footer
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
    container.addChild(
      new Text(
        theme.fg("dim", "  [A] Auto-fix all    [Esc] Skip review"),
        0,
        0,
      ),
    );

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (data === "a" || data === "A") {
          done({ type: "auto_fix" });
        } else if (matchesKey(data, Key.escape)) {
          done({ type: "skip" });
        }
      },
    };
  });

  return result;
}
```

- [ ] **Step 2: Implement steps/user-review.ts**

```typescript
// steps/user-review.ts — Step 8 TUI: final confirmation
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";

export type UserReviewAction =
  | { type: "approve" }
  | { type: "request_changes"; feedback: string }
  | { type: "abort" };

export async function showUserReview(
  ctx: ExtensionContext,
  specPath: string,
): Promise<UserReviewAction> {
  const result = await ctx.ui.custom<UserReviewAction>((tui, theme, _kb, done) => {
    const container = new Container();

    container.addChild(
      new Text(theme.fg("success", theme.bold("  ✓ Spec ready")), 0, 0),
    );
    container.addChild(new Text(theme.fg("muted", `  ${specPath}`), 0, 0));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("text", "  Review the file, then:"), 0, 0));
    container.addChild(
      new Text(
        theme.fg("dim", "  [Enter] ✓ Approve    [R] ✎ Request changes    [Esc] abort"),
        0,
        0,
      ),
    );

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, Key.enter)) {
          done({ type: "approve" });
        } else if (data === "r" || data === "R") {
          ctx.ui.input("What changes do you want?", "").then((feedback) => {
            if (feedback) {
              done({ type: "request_changes", feedback });
            }
          });
        } else if (matchesKey(data, Key.escape)) {
          done({ type: "abort" });
        }
      },
    };
  });

  return result;
}
```

- [ ] **Step 3: Verify syntax**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && for f in steps/self-review.ts steps/user-review.ts; do echo "--- $f ---"; bun build "$f" --no-bundle 2>&1 | tail -1; done`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add steps/self-review.ts steps/user-review.ts
git commit -m "feat: add TUI for self-review and user-review steps"
```

---

## Task 13: Main Extension Entry Point (State Machine Orchestrator)

**Files:**
- Create: `~/.pi/agent/extensions/brainstorm-workflow/index.ts`

- [ ] **Step 1: Implement index.ts**

```typescript
// index.ts — Extension entry: event handlers + state machine orchestrator
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BrainstormState, createInitialState, transition } from "./state.ts";
import { gatherContext } from "./steps/gather-context.ts";
import { showQuestionsForm } from "./steps/questions.ts";
import { showApproachSelector } from "./steps/approaches.ts";
import { showDesignReview } from "./steps/design-review.ts";
import { writeSpec } from "./steps/write-spec.ts";
import { showSelfReview } from "./steps/self-review.ts";
import { showUserReview } from "./steps/user-review.ts";
import { registerBrainstormQuestions } from "./tools/brainstorm-questions.ts";
import { registerBrainstormApproaches } from "./tools/brainstorm-approaches.ts";
import { registerBrainstormDesign } from "./tools/brainstorm-design.ts";
import { registerBrainstormDesignRevision } from "./tools/brainstorm-design-revision.ts";
import { registerBrainstormReview } from "./tools/brainstorm-review.ts";
import {
  getApproachesPrompt,
  getAutoFixPrompt,
  getDesignPrompt,
  getResearchPrompt,
  getRevisionPrompt,
  getReviewPrompt,
} from "./lib/prompts.ts";
import type { Approach, Assumption, DesignSection, Question, ReviewIssue } from "./types.ts";

const BRAINSTORM_FLAG = "--brainstorm";
const SONNET_MODEL_ID = "claude-sonnet-4-20250514";
const OPUS_MODEL_ID = "claude-opus-4-20250514";
const PROVIDER = "anthropic";

// Tools restricted per phase
const RESEARCH_TOOLS = ["bash", "brainstorm_questions"];
const APPROACH_TOOLS = ["brainstorm_approaches"];
const DESIGN_TOOLS = ["brainstorm_design"];
const REVISION_TOOLS = ["brainstorm_design_revision"];
const REVIEW_TOOLS = ["brainstorm_review"];

export default function brainstormWorkflow(pi: ExtensionAPI): void {
  let state: BrainstormState = createInitialState();
  let allToolNames: string[] = [];

  // Register all custom tools
  registerBrainstormQuestions(pi);
  registerBrainstormApproaches(pi);
  registerBrainstormDesign(pi);
  registerBrainstormDesignRevision(pi);
  registerBrainstormReview(pi);

  // --- Helpers ---

  function persist(): void {
    pi.appendEntry("brainstorm-state", state);
  }

  function isActive(): boolean {
    return state.phase !== "IDLE" && state.phase !== "COMPLETE";
  }

  async function setModelToSonnet(ctx: ExtensionContext): Promise<void> {
    if (!state.originalModel) {
      const current = ctx.model;
      if (current) {
        state.originalModel = { provider: current.provider, id: current.id };
      }
    }
    const sonnet = ctx.modelRegistry.find(PROVIDER, SONNET_MODEL_ID);
    if (sonnet) await pi.setModel(sonnet);
  }

  async function setModelToOpus(ctx: ExtensionContext): Promise<void> {
    if (!state.originalModel) {
      const current = ctx.model;
      if (current) {
        state.originalModel = { provider: current.provider, id: current.id };
      }
    }
    const opus = ctx.modelRegistry.find(PROVIDER, OPUS_MODEL_ID);
    if (opus) await pi.setModel(opus);
  }

  async function restoreModel(ctx: ExtensionContext): Promise<void> {
    if (state.originalModel) {
      const model = ctx.modelRegistry.find(state.originalModel.provider, state.originalModel.id);
      if (model) await pi.setModel(model);
    }
  }

  function restoreTools(): void {
    if (allToolNames.length > 0) {
      pi.setActiveTools(allToolNames);
    }
  }

  function formatAssumptions(): string {
    return state.assumptions
      .map((a) => `- ${a.text} (${a.confidence})`)
      .join("\n");
  }

  function formatAnswers(): string {
    return Object.entries(state.answers)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
  }

  // --- Event Handlers ---

  // Intercept --brainstorm input
  pi.on("input", async (event, ctx) => {
    if (!event.text.includes(BRAINSTORM_FLAG)) return { action: "continue" as const };

    // Strip flag and extract prompt
    const prompt = event.text.replace(BRAINSTORM_FLAG, "").trim();
    if (!prompt) {
      ctx.ui.notify("Usage: --brainstorm <your request>", "warning");
      return { action: "handled" as const };
    }

    // Save all tool names before restricting
    allToolNames = pi.getAllTools().map((t) => t.name);

    // Start state machine
    state = transition(createInitialState(), "START", { prompt });
    persist();
    ctx.ui.notify("🧠 Brainstorming started — gathering context...", "info");

    // Step 1: Gather context (deterministic)
    const compressedContext = await gatherContext(pi, ctx.cwd, ctx.signal);
    state = transition(state, "CONTEXT_GATHERED", { compressedContext });
    persist();

    // Step 3: Trigger research LLM turn
    await setModelToSonnet(ctx);
    pi.setActiveTools(RESEARCH_TOOLS);

    const researchPrompt = getResearchPrompt(
      state.compressedContext,
      state.originalPrompt,
    );
    pi.sendUserMessage(researchPrompt, { deliverAs: "followUp" });

    return { action: "handled" as const };
  });

  // Inject system prompt based on current phase
  pi.on("before_agent_start", async (event, ctx) => {
    if (!isActive()) return;

    switch (state.phase) {
      case "RESEARCHING_AND_QUESTIONING":
        return {
          systemPrompt: event.systemPrompt + "\n\n" + getResearchPrompt(
            state.compressedContext,
            state.originalPrompt,
            state.answers,
          ),
        };

      case "PROPOSING_APPROACHES":
        return {
          systemPrompt: event.systemPrompt + "\n\n" + getApproachesPrompt(
            state.compressedContext,
            state.originalPrompt,
            formatAssumptions(),
            formatAnswers(),
          ),
        };

      case "GENERATING_DESIGN": {
        const selected = state.approaches.find((a) => a.id === state.selectedApproach);
        const approachText = selected
          ? `${selected.title}: ${selected.summary}`
          : state.selectedApproach || "";
        return {
          systemPrompt: event.systemPrompt + "\n\n" + getDesignPrompt(
            state.compressedContext,
            state.originalPrompt,
            approachText,
            formatAssumptions(),
            formatAnswers(),
          ),
        };
      }

      case "SELF_REVIEW":
        if (state.specPath) {
          const specContent = state.design
            ? state.design.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")
            : "";
          return {
            systemPrompt: event.systemPrompt + "\n\n" + getReviewPrompt(specContent),
          };
        }
        break;
    }
  });

  // Handle tool results and drive state machine forward
  pi.on("agent_end", async (_event, ctx) => {
    if (!isActive() || !ctx.hasUI) return;

    // Get last tool result from session
    const entries = ctx.sessionManager.getBranch();
    const lastToolResult = [...entries]
      .reverse()
      .find(
        (e: any) =>
          e.type === "message" &&
          e.message?.role === "toolResult" &&
          [
            "brainstorm_questions",
            "brainstorm_approaches",
            "brainstorm_design",
            "brainstorm_design_revision",
            "brainstorm_review",
          ].includes(e.message.toolName),
      ) as any;

    if (!lastToolResult) return;

    const toolName = lastToolResult.message.toolName;
    const details = lastToolResult.message.details;

    // --- Handle brainstorm_questions ---
    if (toolName === "brainstorm_questions" && state.phase === "RESEARCHING_AND_QUESTIONING") {
      const assumptions: Assumption[] = details.assumptions ?? [];
      const questions: Question[] = details.questions ?? [];
      const done: boolean = details.done ?? false;

      state = transition(state, "QUESTIONS_RECEIVED", { assumptions, questions });
      persist();

      // Show TUI form
      const formResult = await showQuestionsForm(
        ctx,
        state.assumptions,
        state.questions,
        state.originalPrompt.slice(0, 50),
      );

      if (formResult.cancelled) {
        state = transition(state, "RESET");
        restoreTools();
        await restoreModel(ctx);
        persist();
        ctx.ui.notify("Brainstorming cancelled.", "info");
        return;
      }

      if (formResult.challengedAssumption) {
        // Re-iterate with LLM
        state = transition(state, "FORM_CONFIRMED", { answers: formResult.answers, done: false });
        persist();
        pi.sendUserMessage(
          `The user challenges an assumption: "${formResult.challengedAssumption.observation}". Re-evaluate and provide updated questions.`,
          { deliverAs: "followUp" },
        );
        return;
      }

      state = transition(state, "FORM_CONFIRMED", { answers: formResult.answers, done });
      persist();

      if (done || formResult.skipped) {
        // Move to approaches
        pi.setActiveTools(APPROACH_TOOLS);
        const prompt = getApproachesPrompt(
          state.compressedContext,
          state.originalPrompt,
          formatAssumptions(),
          formatAnswers(),
        );
        pi.sendUserMessage(prompt, { deliverAs: "followUp" });
      } else {
        // Another round of questions
        pi.sendUserMessage("Continue researching and ask follow-up questions.", {
          deliverAs: "followUp",
        });
      }
      return;
    }

    // --- Handle brainstorm_approaches ---
    if (toolName === "brainstorm_approaches" && state.phase === "PROPOSING_APPROACHES") {
      const approaches: Approach[] = details.approaches ?? [];
      const recommendation: string = details.recommendation ?? "";
      const reasoning: string = details.recommendation_reasoning ?? "";

      state = transition(state, "APPROACHES_RECEIVED", { approaches, recommendation });
      persist();

      // Show approach selector TUI
      const selection = await showApproachSelector(ctx, approaches, recommendation, reasoning);

      if (selection.cancelled || !selection.selectedId) {
        state = transition(state, "RESET");
        restoreTools();
        await restoreModel(ctx);
        persist();
        ctx.ui.notify("Brainstorming cancelled.", "info");
        return;
      }

      state = transition(state, "APPROACH_SELECTED", { approachId: selection.selectedId });
      persist();

      // Switch to opus for design generation
      await setModelToOpus(ctx);
      pi.setActiveTools(DESIGN_TOOLS);

      const selected = approaches.find((a) => a.id === selection.selectedId);
      const approachText = selected
        ? `${selected.title}: ${selected.summary}`
        : selection.selectedId;

      const prompt = getDesignPrompt(
        state.compressedContext,
        state.originalPrompt,
        approachText,
        formatAssumptions(),
        formatAnswers(),
      );
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
      return;
    }

    // --- Handle brainstorm_design ---
    if (toolName === "brainstorm_design" && state.phase === "GENERATING_DESIGN") {
      const title: string = details.title ?? "Untitled";
      const sections: DesignSection[] = details.sections ?? [];

      state = transition(state, "DESIGN_RECEIVED", { title, sections });
      persist();

      // Section-by-section review
      let allApproved = true;
      for (let i = 0; i < sections.length; i++) {
        const action = await showDesignReview(ctx, title, state.design!.sections, i);

        if (action.type === "abort") {
          state = transition(state, "RESET");
          restoreTools();
          await restoreModel(ctx);
          persist();
          ctx.ui.notify("Brainstorming cancelled.", "info");
          return;
        }

        if (action.type === "request_changes") {
          // Use sonnet for revision
          await setModelToSonnet(ctx);
          pi.setActiveTools(REVISION_TOOLS);
          const revisionPrompt = getRevisionPrompt(sections[i].content, action.feedback);
          pi.sendUserMessage(revisionPrompt, { deliverAs: "followUp" });
          allApproved = false;
          break;
        }
        // "approve" → continue to next section
      }

      if (allApproved) {
        state = transition(state, "DESIGN_APPROVED");
        persist();

        // Step 6: Write spec (deterministic)
        const specPath = await writeSpec(ctx.cwd, {
          title: state.design!.title,
          selectedApproach: state.approaches.find((a) => a.id === state.selectedApproach)?.title ?? "",
          assumptions: state.assumptions,
          answers: state.answers,
          questions: state.questions,
          sections: state.design!.sections,
        });

        state = transition(state, "SPEC_WRITTEN", { specPath });
        persist();

        // Step 7: Self-review with opus
        await setModelToOpus(ctx);
        pi.setActiveTools(REVIEW_TOOLS);
        const specContent = state.design!.sections
          .map((s) => `## ${s.title}\n${s.content}`)
          .join("\n\n");
        const reviewPrompt = getReviewPrompt(specContent);
        pi.sendUserMessage(reviewPrompt, { deliverAs: "followUp" });
      }
      return;
    }

    // --- Handle brainstorm_design_revision ---
    if (toolName === "brainstorm_design_revision" && state.phase === "DESIGN_REVIEW") {
      const sectionId: string = details.section_id;
      const content: string = details.content;
      const wireframe = details.wireframe;

      // Update the section in state
      if (state.design) {
        const idx = state.design.sections.findIndex((s) => s.id === sectionId);
        if (idx >= 0) {
          state.design.sections[idx] = {
            ...state.design.sections[idx],
            content,
            wireframe,
          };
        }
      }
      persist();

      // Re-present design review from revised section onwards
      // For simplicity, restart review from the revised section
      const sectionIdx = state.design?.sections.findIndex((s) => s.id === sectionId) ?? 0;
      let allApproved = true;

      for (let i = sectionIdx; i < (state.design?.sections.length ?? 0); i++) {
        const action = await showDesignReview(ctx, state.design!.title, state.design!.sections, i);

        if (action.type === "abort") {
          state = transition(state, "RESET");
          restoreTools();
          await restoreModel(ctx);
          persist();
          ctx.ui.notify("Brainstorming cancelled.", "info");
          return;
        }

        if (action.type === "request_changes") {
          await setModelToSonnet(ctx);
          pi.setActiveTools(REVISION_TOOLS);
          const revisionPrompt = getRevisionPrompt(
            state.design!.sections[i].content,
            action.feedback,
          );
          pi.sendUserMessage(revisionPrompt, { deliverAs: "followUp" });
          allApproved = false;
          break;
        }
      }

      if (allApproved) {
        state = transition(state, "DESIGN_APPROVED");
        persist();

        const specPath = await writeSpec(ctx.cwd, {
          title: state.design!.title,
          selectedApproach: state.approaches.find((a) => a.id === state.selectedApproach)?.title ?? "",
          assumptions: state.assumptions,
          answers: state.answers,
          questions: state.questions,
          sections: state.design!.sections,
        });

        state = transition(state, "SPEC_WRITTEN", { specPath });
        persist();

        await setModelToOpus(ctx);
        pi.setActiveTools(REVIEW_TOOLS);
        const specContent = state.design!.sections
          .map((s) => `## ${s.title}\n${s.content}`)
          .join("\n\n");
        pi.sendUserMessage(getReviewPrompt(specContent), { deliverAs: "followUp" });
      }
      return;
    }

    // --- Handle brainstorm_review ---
    if (toolName === "brainstorm_review" && state.phase === "SELF_REVIEW") {
      const status: "pass" | "issues_found" = details.status;
      const issues: ReviewIssue[] = details.issues ?? [];
      const summary: string = details.summary ?? "";

      state = transition(state, "REVIEW_RECEIVED", { result: { status, issues, summary } });
      persist();

      if (status === "pass") {
        // Go directly to user review
        const userAction = await showUserReview(ctx, state.specPath!);

        if (userAction.type === "approve") {
          state = transition(state, "USER_APPROVED");
          restoreTools();
          await restoreModel(ctx);
          persist();
          ctx.ui.notify(`✓ Brainstorming complete\n  Spec: ${state.specPath}`, "info");
        } else if (userAction.type === "request_changes") {
          // Sonnet applies changes
          await setModelToSonnet(ctx);
          pi.setActiveTools(DESIGN_TOOLS);
          pi.sendUserMessage(
            `Apply these changes to the design: ${userAction.feedback}`,
            { deliverAs: "followUp" },
          );
        } else {
          state = transition(state, "RESET");
          restoreTools();
          await restoreModel(ctx);
          persist();
          ctx.ui.notify("Brainstorming cancelled.", "info");
        }
      } else {
        // Show issues TUI
        const reviewAction = await showSelfReview(ctx, issues, summary);

        if (reviewAction.type === "auto_fix") {
          await setModelToSonnet(ctx);
          pi.setActiveTools(DESIGN_TOOLS);
          const issuesText = issues
            .map((i) => `[${i.severity}] ${i.section} — ${i.type}: ${i.description}\n  Suggestion: ${i.suggestion}`)
            .join("\n\n");
          const specContent = state.design?.sections
            .map((s) => `## ${s.title}\n${s.content}`)
            .join("\n\n") ?? "";
          pi.sendUserMessage(getAutoFixPrompt(specContent, issuesText), { deliverAs: "followUp" });
        } else {
          // Skip review, go to user review
          const userAction = await showUserReview(ctx, state.specPath!);

          if (userAction.type === "approve") {
            state = transition(state, "USER_APPROVED");
            restoreTools();
            await restoreModel(ctx);
            persist();
            ctx.ui.notify(`✓ Brainstorming complete\n  Spec: ${state.specPath}`, "info");
          } else if (userAction.type === "request_changes") {
            await setModelToSonnet(ctx);
            pi.setActiveTools(DESIGN_TOOLS);
            pi.sendUserMessage(
              `Apply these changes to the design: ${userAction.feedback}`,
              { deliverAs: "followUp" },
            );
          } else {
            state = transition(state, "RESET");
            restoreTools();
            await restoreModel(ctx);
            persist();
            ctx.ui.notify("Brainstorming cancelled.", "info");
          }
        }
      }
      return;
    }
  });

  // Restore state on session start
  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const lastStateEntry = [...entries]
      .reverse()
      .find(
        (e: any) => e.type === "custom" && e.customType === "brainstorm-state",
      ) as any;

    if (lastStateEntry?.data) {
      state = lastStateEntry.data as BrainstormState;
      if (isActive()) {
        allToolNames = pi.getAllTools().map((t) => t.name);
        ctx.ui.setStatus(
          "brainstorm",
          ctx.ui.theme.fg("accent", `🧠 brainstorm: ${state.phase}`),
        );
      }
    }
  });

  // Show status while active
  pi.on("turn_start", async (_event, ctx) => {
    if (isActive()) {
      ctx.ui.setStatus(
        "brainstorm",
        ctx.ui.theme.fg("accent", `🧠 ${state.phase}`),
      );
    }
  });

  // Clear status on completion or reset
  pi.on("turn_end", async (_event, ctx) => {
    if (!isActive()) {
      ctx.ui.setStatus("brainstorm", undefined);
    }
  });

  // Register /brainstorm command as alternative trigger
  pi.registerCommand("brainstorm", {
    description: "Start a brainstorming session for design exploration",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify("Usage: /brainstorm <your request>", "warning");
        return;
      }
      // Simulate input with flag
      pi.sendUserMessage(`--brainstorm ${args}`);
    },
  });
}
```

- [ ] **Step 2: Verify index.ts compiles**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun build index.ts --no-bundle 2>&1 | head -10`
Expected: No syntax errors (external import resolution warnings are OK).

- [ ] **Step 3: Commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add index.ts
git commit -m "feat: add main extension entry with state machine orchestrator"
```

---

## Task 14: Run All Tests

**Files:**
- All test files in `tests/`

- [ ] **Step 1: Run full test suite**

Run: `cd ~/.pi/agent/extensions/brainstorm-workflow && bun test`
Expected: All tests PASS (state.test.ts, compress.test.ts, wireframe.test.ts, write-spec.test.ts).

- [ ] **Step 2: Fix any failures**

If any test fails, fix the implementation to match the test expectations.

- [ ] **Step 3: Commit if fixes were needed**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add -A
git commit -m "fix: resolve test failures"
```

---

## Task 15: Smoke Test Extension Loading

**Files:**
- No new files

- [ ] **Step 1: Verify extension loads in pi**

Run: `pi -e ~/.pi/agent/extensions/brainstorm-workflow/index.ts --no-session -p "hello" 2>&1 | head -20`
Expected: pi starts without crashing, responds to "hello" prompt. No extension loading errors.

- [ ] **Step 2: Verify tools are registered**

Run: `pi -e ~/.pi/agent/extensions/brainstorm-workflow/index.ts --no-session --list-tools 2>&1 | grep brainstorm`
Expected: Shows `brainstorm_questions`, `brainstorm_approaches`, `brainstorm_design`, `brainstorm_design_revision`, `brainstorm_review`.

- [ ] **Step 3: Verify /brainstorm command exists**

Run: `pi -e ~/.pi/agent/extensions/brainstorm-workflow/index.ts --no-session --list-commands 2>&1 | grep brainstorm`
Expected: Shows `brainstorm` command.

- [ ] **Step 4: Commit final state**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add -A
git commit -m "chore: verify extension loads and tools register"
```

---

## Task 16: Install Extension Permanently

**Files:**
- Modify: `~/.pi/agent/extensions/brainstorm-workflow/package.json` (already in auto-discover location)

- [ ] **Step 1: Verify auto-discovery path**

The extension is at `~/.pi/agent/extensions/brainstorm-workflow/index.ts` — this is an auto-discovered location per pi docs. The `package.json` has `"pi": { "extensions": ["./index.ts"] }` which tells pi to load `index.ts` as the extension entry point.

Run: `pi --no-session -p "hello" 2>&1 | head -5`
Expected: pi loads without errors. The extension is auto-discovered.

- [ ] **Step 2: Test end-to-end with --brainstorm flag**

Run: `pi` (interactive mode)
Type: `--brainstorm build a simple TODO API with persistence`
Expected: See "🧠 Brainstorming started — gathering context..." notification, followed by context gathering, then LLM research phase.

- [ ] **Step 3: Final commit**

```bash
cd ~/.pi/agent/extensions/brainstorm-workflow
git add -A
git commit -m "feat: brainstorm-workflow extension complete"
```

---

## Notes

### Model IDs

The plan uses `claude-sonnet-4-20250514` and `claude-opus-4-20250514`. These should be verified against the user's available models at implementation time. If the exact IDs differ, update the constants in `index.ts`.

### Edge Cases Not Covered (deferred)

1. **Visual Companion** — marked as TODO in spec, deferred.
2. **Graphify queries** — the extension detects `graphify-out/` but keyword extraction from graphify requires LLM. This is handled implicitly during the research phase (the LLM has access to bash and can run graphify commands).
3. **Multiple `--brainstorm` invocations** — if user triggers while already in a session, the `input` handler should either reset or reject. Current implementation starts fresh (overwrites state).
4. **Session resume with partial state** — the `session_start` handler restores state, but resuming mid-TUI interaction is not supported (user would need to re-trigger).

### Token Budget Verification

Per spec, typical total should be ~42,000 tokens vs ~262,000 with the skill approach. This is achieved by:
- Compressed context ≤ 2,000 tokens (enforced in `assembleCompressedContext`)
- Terminating tools eliminate follow-up assistant messages
- Focused system prompts per phase instead of one large prompt

