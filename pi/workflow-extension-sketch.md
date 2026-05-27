# Workflow Orchestrator Extension — Sketch

## Architecture: State Machine + LLM Only When Creative

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        STATE MACHINE (extension code)                     │
│                                                                          │
│  /workflow <idea>                                                         │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────┐  code: exec, fs     ┌──────────┐  LLM (sonnet)            │
│  │  INIT   │ ──────────────────►  │ RESEARCH │ ──── terminate tool ──┐  │
│  └─────────┘  read tree, git,     └──────────┘  generate questions   │  │
│               package.json                                            │  │
│                                                                       ▼  │
│  ┌───────────┐  TUI: ctx.ui      ┌────────────┐  LLM (sonnet)          │
│  │ QUESTIONS │ ◄────────────────  │ ASK_USER   │ ◄── questions JSON  │  │
│  └───────────┘  show 1-by-1       └────────────┘                     │  │
│       │                                                               │  │
│       ▼ (all answers collected)                                       │  │
│  ┌────────────┐  LLM (sonnet)    ┌─────────────┐  TUI: select       │  │
│  │ APPROACHES │ ── terminate ──►  │ USER_PICKS  │ ── user chooses ──┐│  │
│  └────────────┘  2-3 options      └─────────────┘                   ││  │
│                                                                      ▼│  │
│  ┌──────────┐  LLM (opus)        ┌─────────────┐  TUI: confirm     │  │
│  │  DESIGN  │ ── terminate ───►   │ USER_REVIEW │ ── approve? ─────┐│  │
│  └──────────┘  write full spec    └─────────────┘                   ││  │
│                                                                      ▼│  │
│  ┌───────────┐  code: fs.write    ┌──────────┐  LLM (sonnet)        │  │
│  │ SAVE_SPEC │ ── commit ───────► │   PLAN   │ ── terminate ─────┐  │  │
│  └───────────┘  0 tokens          └──────────┘  write full plan   │  │  │
│                                                                    ▼  │  │
│  ┌───────────┐  code: fs.write    ┌──────────┐  subagents           │  │
│  │ SAVE_PLAN │ ── commit ───────► │ EXECUTE  │ ── per task ─────►   │  │
│  └───────────┘  0 tokens          └──────────┘                      │  │
│                                                                      │  │
└──────────────────────────────────────────────────────────────────────┘  │
```

## Token Flow Comparison

| Step | Traditional (LLM orchestrates) | This Extension |
|------|-------------------------------|----------------|
| Read project tree | LLM calls eza (1 turn, ~7K input) | `pi.exec("eza")` — 0 tokens |
| Read package.json | LLM calls read (1 turn, ~10K input) | `fs.readFile()` — 0 tokens |
| Git log | LLM calls bash (1 turn, ~13K input) | `pi.exec("git log")` — 0 tokens |
| Ask user 4 questions | 4 turns × ~15K each = 60K | `ctx.ui.input()` × 4 — 0 tokens |
| User picks approach | 1 turn ~20K | `ctx.ui.select()` — 0 tokens |
| Save spec file | LLM calls write (1 turn ~24K) | `fs.writeFile()` — 0 tokens |
| Git commit | LLM calls bash (1 turn ~27K) | `pi.exec("git commit")` — 0 tokens |

**Savings: every row marked "0 tokens" was previously a full LLM turn with growing context.**

---

## Extension Structure

```
~/.pi/agent/extensions/workflow-orchestrator/
├── package.json           # deps: @anthropic-ai/sdk (or uses session LLM)
├── index.ts               # Entry point, registerCommand + registerTools
├── state-machine.ts       # State transitions, persistence
├── context-builder.ts     # Mechanical: reads project, compresses context
├── tools/
│   ├── research.ts        # terminate tool: LLM generates questions
│   ├── approaches.ts      # terminate tool: LLM proposes approaches  
│   ├── design.ts          # terminate tool: LLM writes spec
│   └── plan.ts            # terminate tool: LLM writes plan
├── prompts/
│   ├── research.md        # System prompt for research step
│   ├── approaches.md      # System prompt for approaches step
│   ├── design.md          # System prompt for design step
│   └── plan.md            # System prompt for plan step
└── config.ts              # Model routing config
```

---

## Key Code Patterns

### index.ts — Entry Point

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { WorkflowStateMachine, type WorkflowState } from "./state-machine";
import { buildProjectContext } from "./context-builder";
import { MODELS } from "./config";

export default function (pi: ExtensionAPI) {
  let workflow: WorkflowStateMachine | null = null;

  // ─── Restore state on session load ───
  pi.on("session_start", async (_event, ctx) => {
    workflow = WorkflowStateMachine.restore(ctx.sessionManager);
  });

  // ─── Command: /workflow <idea> ───
  pi.registerCommand("workflow", {
    description: "Start orchestrated brainstorm → plan → execute workflow",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /workflow <describe your idea>", "error");
        return;
      }

      // ═══ STEP 1: MECHANICAL — Read project context (0 tokens) ═══
      ctx.ui.setStatus("workflow", "Reading project context...");

      const projectContext = await buildProjectContext(pi, ctx.cwd);
      // projectContext = compressed string ~1.5K tokens
      // contains: tree, tech stack, recent commits, key files

      workflow = new WorkflowStateMachine({
        idea: args.trim(),
        projectContext,
      });

      // Persist state
      pi.appendEntry("workflow-state", workflow.serialize());

      ctx.ui.setStatus("workflow", "Starting research...");

      // ═══ STEP 2: TRIGGER LLM — Research + generate questions ═══
      // Switch to sonnet for research
      const sonnet = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-20250514");
      if (sonnet) await pi.setModel(sonnet);

      // Send compressed context to LLM, instruct it to call the terminate tool
      pi.sendUserMessage(
        `You are in workflow orchestration mode. Your ONLY job is to call the workflow_research tool.\n\n` +
        `## User's Idea\n${args.trim()}\n\n` +
        `## Project Context (pre-gathered)\n${projectContext}\n\n` +
        `Generate 3-5 clarifying questions to understand this idea better. ` +
        `Call workflow_research with your questions now.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ─── TERMINATE TOOL: Research → generates questions ───
  pi.registerTool({
    name: "workflow_research",
    label: "Workflow: Research",
    description: "Submit clarifying questions for the workflow. Call this with your questions.",
    parameters: Type.Object({
      questions: Type.Array(Type.Object({
        question: Type.String({ description: "The question text" }),
        options: Type.Optional(Type.Array(Type.String(), {
          description: "Multiple choice options if applicable",
        })),
      })),
    }),
    terminate: true, // ← LLM stops after this
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!workflow) throw new Error("No active workflow");

      workflow.setState("ASK_USER");
      workflow.setQuestions(params.questions);
      pi.appendEntry("workflow-state", workflow.serialize());

      // ═══ STEP 3: TUI — Ask questions one by one (0 tokens) ═══
      const answers: string[] = [];

      for (const q of params.questions) {
        let answer: string | undefined;

        if (q.options?.length) {
          // Multiple choice via TUI
          answer = await ctx.ui.select(q.question, q.options);
        } else {
          // Free text via TUI
          answer = await ctx.ui.input(q.question) ?? "";
        }

        answers.push(answer ?? "skip");
      }

      workflow.setAnswers(answers);
      workflow.setState("APPROACHES");
      pi.appendEntry("workflow-state", workflow.serialize());

      // ═══ STEP 4: TRIGGER NEXT LLM STEP — Propose approaches ═══
      // The tool returns, then we trigger the next LLM turn
      setTimeout(() => {
        pi.sendUserMessage(
          `You are in workflow orchestration mode. Call workflow_approaches.\n\n` +
          `## Idea\n${workflow!.idea}\n\n` +
          `## Q&A Results\n${workflow!.formatQA()}\n\n` +
          `## Project Context\n${workflow!.projectContext}\n\n` +
          `Propose 2-3 implementation approaches with trade-offs and a recommendation.`,
          { deliverAs: "followUp" }
        );
      }, 100);

      return {
        content: [{ type: "text", text: "Questions answered via TUI. Proceeding to approaches." }],
        details: { answers },
      };
    },
  });

  // ─── TERMINATE TOOL: Approaches ───
  pi.registerTool({
    name: "workflow_approaches",
    label: "Workflow: Approaches",
    description: "Submit 2-3 implementation approaches. Call this with your proposals.",
    parameters: Type.Object({
      approaches: Type.Array(Type.Object({
        name: Type.String(),
        description: Type.String(),
        tradeoffs: Type.String(),
      })),
      recommendation: Type.String({ description: "Which approach you recommend and why" }),
    }),
    terminate: true,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!workflow) throw new Error("No active workflow");

      // ═══ STEP 5: TUI — User picks approach (0 tokens) ═══
      const options = params.approaches.map((a, i) =>
        `${i + 1}. ${a.name}: ${a.description}\n   Tradeoffs: ${a.tradeoffs}`
      );

      ctx.ui.notify(`Recommendation: ${params.recommendation}`, "info");

      const choice = await ctx.ui.select(
        "Pick an approach:",
        params.approaches.map(a => a.name)
      );

      const chosen = params.approaches.find(a => a.name === choice) ?? params.approaches[0];
      workflow.setChosenApproach(chosen);
      workflow.setState("DESIGN");
      pi.appendEntry("workflow-state", workflow.serialize());

      // ═══ STEP 6: TRIGGER DESIGN — Switch to opus ═══
      const opus = ctx.modelRegistry.find("anthropic", "claude-opus-4-20250514");
      if (opus) await pi.setModel(opus);

      setTimeout(() => {
        pi.sendUserMessage(
          `You are in workflow orchestration mode. Call workflow_design.\n\n` +
          `## Idea\n${workflow!.idea}\n\n` +
          `## Chosen Approach\n${JSON.stringify(workflow!.chosenApproach)}\n\n` +
          `## Q&A Context\n${workflow!.formatQA()}\n\n` +
          `## Project Context\n${workflow!.projectContext}\n\n` +
          `Write a complete design spec. Cover: architecture, components, data flow, ` +
          `error handling, testing strategy. Be thorough but focused.`,
          { deliverAs: "followUp" }
        );
      }, 100);

      return {
        content: [{ type: "text", text: `User chose: ${chosen.name}. Proceeding to design.` }],
        details: { chosen },
      };
    },
  });

  // ─── TERMINATE TOOL: Design ───
  pi.registerTool({
    name: "workflow_design",
    label: "Workflow: Design",
    description: "Submit the complete design spec.",
    parameters: Type.Object({
      title: Type.String(),
      spec: Type.String({ description: "Complete design spec in markdown" }),
    }),
    terminate: true,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!workflow) throw new Error("No active workflow");

      workflow.setSpec(params.spec);
      workflow.setState("USER_REVIEW");
      pi.appendEntry("workflow-state", workflow.serialize());

      // ═══ STEP 7: TUI — User reviews spec (0 tokens) ═══
      // Show spec in editor for review
      const feedback = await ctx.ui.editor(
        "Review the spec (edit to provide feedback, or leave empty to approve):",
        params.spec
      );

      const approved = !feedback?.trim() || feedback === params.spec;

      if (!approved) {
        // User gave feedback → re-trigger design with feedback
        workflow.setState("DESIGN");
        pi.appendEntry("workflow-state", workflow.serialize());

        setTimeout(() => {
          pi.sendUserMessage(
            `You are in workflow orchestration mode. Call workflow_design again.\n\n` +
            `## Previous Spec\n${params.spec}\n\n` +
            `## User Feedback\n${feedback}\n\n` +
            `Revise the spec addressing the feedback. Call workflow_design.`,
            { deliverAs: "followUp" }
          );
        }, 100);

        return {
          content: [{ type: "text", text: "User requested revisions. Re-generating design." }],
          details: { feedback },
        };
      }

      // ═══ STEP 8: MECHANICAL — Save spec + commit (0 tokens) ═══
      const date = new Date().toISOString().split("T")[0];
      const slug = workflow.idea.slice(0, 30).replace(/\s+/g, "-").toLowerCase();
      const specPath = `docs/superpowers/specs/${date}-${slug}-design.md`;

      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");

      await mkdir(dirname(specPath), { recursive: true });
      await writeFile(specPath, `# ${params.title}\n\n${params.spec}`, "utf8");
      await pi.exec("git", ["add", specPath]);
      await pi.exec("git", ["commit", "-m", `docs: add spec for ${slug}`]);

      workflow.setSpecPath(specPath);
      workflow.setState("PLAN");
      pi.appendEntry("workflow-state", workflow.serialize());

      ctx.ui.notify(`Spec saved: ${specPath}`, "info");

      // ═══ STEP 9: TRIGGER PLAN — Switch back to sonnet ═══
      const sonnet = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-20250514");
      if (sonnet) await pi.setModel(sonnet);

      setTimeout(() => {
        pi.sendUserMessage(
          `You are in workflow orchestration mode. Call workflow_plan.\n\n` +
          `## Spec\n${params.spec}\n\n` +
          `## Project Context\n${workflow!.projectContext}\n\n` +
          `Write a complete implementation plan with bite-sized tasks. ` +
          `Each task: files, TDD steps with actual code, exact commands, commit messages. ` +
          `No placeholders. No TODOs. Complete code in every step.`,
          { deliverAs: "followUp" }
        );
      }, 100);

      return {
        content: [{ type: "text", text: `Spec approved and saved. Generating plan...` }],
        details: { specPath },
      };
    },
  });

  // ─── TERMINATE TOOL: Plan ───
  pi.registerTool({
    name: "workflow_plan",
    label: "Workflow: Plan",
    description: "Submit the complete implementation plan.",
    parameters: Type.Object({
      plan: Type.String({ description: "Complete implementation plan in markdown" }),
    }),
    terminate: true,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!workflow) throw new Error("No active workflow");

      // ═══ STEP 10: MECHANICAL — Save plan + commit (0 tokens) ═══
      const date = new Date().toISOString().split("T")[0];
      const slug = workflow.idea.slice(0, 30).replace(/\s+/g, "-").toLowerCase();
      const planPath = `docs/superpowers/plans/${date}-${slug}.md`;

      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");

      await mkdir(dirname(planPath), { recursive: true });
      await writeFile(planPath, params.plan, "utf8");
      await pi.exec("git", ["add", planPath]);
      await pi.exec("git", ["commit", "-m", `docs: add plan for ${slug}`]);

      workflow.setPlanPath(planPath);
      workflow.setState("EXECUTE");
      pi.appendEntry("workflow-state", workflow.serialize());

      ctx.ui.notify(`Plan saved: ${planPath}`, "info");

      // ═══ STEP 11: TRIGGER EXECUTION — subagent-driven ═══
      // From here: send the plan to the LLM with instructions to execute
      // using subagent-driven-development pattern
      setTimeout(() => {
        pi.sendUserMessage(
          `Plan saved at ${planPath}. Execute it now using subagent-driven-development:\n\n` +
          `- Dispatch fresh subagent per task\n` +
          `- Two-stage review (spec compliance + code quality)\n` +
          `- Don't stop between tasks\n\n` +
          `Here is the plan:\n\n${params.plan}`,
          { deliverAs: "followUp" }
        );
      }, 100);

      return {
        content: [{ type: "text", text: `Plan saved. Starting execution...` }],
        details: { planPath },
      };
    },
  });

  // ─── CONTEXT EVENT: Strip history, send only what's needed ───
  pi.on("context", async (event, _ctx) => {
    if (!workflow || workflow.state === "EXECUTE") return; // During execution, normal behavior

    // During workflow orchestration: only keep the LAST user message
    // This prevents context accumulation
    const messages = event.messages;
    const lastUserIdx = messages.findLastIndex(
      m => m.type === "message" && m.message.role === "user"
    );

    if (lastUserIdx > 0 && workflow.isActive()) {
      // Keep only: system prompt context + last user message
      return { messages: messages.slice(lastUserIdx) };
    }
  });
}
```

### context-builder.ts — Mechanical Context Gathering (0 tokens)

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Reads project context mechanically. No LLM involved.
 * Returns a compressed string (~1.5K tokens) with everything
 * the LLM needs to understand the project.
 */
export async function buildProjectContext(
  pi: ExtensionAPI,
  cwd: string
): Promise<string> {
  const sections: string[] = [];

  // 1. Directory tree (depth 2)
  const tree = await pi.exec("eza", ["--tree", "--level=2", "-I", "node_modules|.git|dist"], { cwd });
  if (tree.code === 0) {
    sections.push(`## Project Structure\n\`\`\`\n${truncate(tree.stdout, 2000)}\n\`\`\``);
  }

  // 2. Package.json — extract only what matters
  const pkg = await pi.exec("cat", ["package.json"], { cwd });
  if (pkg.code === 0) {
    try {
      const parsed = JSON.parse(pkg.stdout);
      const summary = {
        name: parsed.name,
        description: parsed.description,
        scripts: Object.keys(parsed.scripts ?? {}),
        deps: Object.keys(parsed.dependencies ?? {}),
        devDeps: Object.keys(parsed.devDependencies ?? {}),
      };
      sections.push(`## Tech Stack\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``);
    } catch { /* not a node project */ }
  }

  // 3. Recent commits (context of recent work)
  const git = await pi.exec("git", ["log", "--oneline", "-10"], { cwd });
  if (git.code === 0) {
    sections.push(`## Recent Commits\n\`\`\`\n${git.stdout}\n\`\`\``);
  }

  // 4. README first 50 lines
  const readme = await pi.exec("head", ["-50", "README.md"], { cwd });
  if (readme.code === 0) {
    sections.push(`## README (excerpt)\n${truncate(readme.stdout, 1000)}`);
  }

  return sections.join("\n\n");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... (truncated)";
}
```

### config.ts — Model Routing

```typescript
/**
 * Model routing per step.
 * Sonnet for structured output + research.
 * Opus for creative synthesis + critical review.
 */
export const MODEL_ROUTING = {
  research:   { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  approaches: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  design:     { provider: "anthropic", model: "claude-opus-4-20250514" },
  plan:       { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  review:     { provider: "anthropic", model: "claude-opus-4-20250514" },
  implement:  { provider: "anthropic", model: "claude-sonnet-4-20250514" },
} as const;
```

### state-machine.ts — State Persistence

```typescript
export type WorkflowStep =
  | "INIT"
  | "RESEARCH"
  | "ASK_USER"
  | "APPROACHES"
  | "DESIGN"
  | "USER_REVIEW"
  | "PLAN"
  | "EXECUTE"
  | "DONE";

export class WorkflowStateMachine {
  state: WorkflowStep = "INIT";
  idea: string;
  projectContext: string;
  questions: Array<{ question: string; options?: string[] }> = [];
  answers: string[] = [];
  chosenApproach: any = null;
  spec: string = "";
  specPath: string = "";
  planPath: string = "";

  constructor(init: { idea: string; projectContext: string }) {
    this.idea = init.idea;
    this.projectContext = init.projectContext;
  }

  isActive(): boolean {
    return this.state !== "DONE" && this.state !== "EXECUTE";
  }

  formatQA(): string {
    return this.questions
      .map((q, i) => `Q: ${q.question}\nA: ${this.answers[i] ?? "—"}`)
      .join("\n\n");
  }

  setState(s: WorkflowStep) { this.state = s; }
  setQuestions(q: typeof this.questions) { this.questions = q; }
  setAnswers(a: string[]) { this.answers = a; }
  setChosenApproach(a: any) { this.chosenApproach = a; }
  setSpec(s: string) { this.spec = s; }
  setSpecPath(p: string) { this.specPath = p; }
  setPlanPath(p: string) { this.planPath = p; }

  serialize(): object {
    return { ...this };
  }

  static restore(sessionManager: any): WorkflowStateMachine | null {
    const entries = sessionManager.getEntries();
    let lastState = null;
    for (const entry of entries) {
      if (entry.type === "custom" && entry.customType === "workflow-state") {
        lastState = entry.data;
      }
    }
    if (!lastState) return null;
    const wf = new WorkflowStateMachine({
      idea: lastState.idea,
      projectContext: lastState.projectContext,
    });
    Object.assign(wf, lastState);
    return wf;
  }
}
```

---

## Flow Diagram: What Uses Tokens vs. What Doesn't

```
/workflow "add caching layer"
    │
    ▼ ────────────────────── MECHANICAL (0 tokens)
    eza --tree
    cat package.json
    git log --oneline -10
    head -50 README.md
    → compress to ~1.5K string
    │
    ▼ ────────────────────── LLM TURN 1 (sonnet, ~4K input)
    Context: compressed project + idea
    Output: workflow_research({ questions: [...] })
    terminate: true → turn ends
    │
    ▼ ────────────────────── TUI (0 tokens)
    ctx.ui.select("Question 1?", options)
    ctx.ui.input("Question 2?")
    ctx.ui.select("Question 3?", options)
    → collect all answers
    │
    ▼ ────────────────────── LLM TURN 2 (sonnet, ~5K input)
    Context: idea + Q&A + project (compressed)
    Output: workflow_approaches({ approaches: [...] })
    terminate: true → turn ends
    │
    ▼ ────────────────────── TUI (0 tokens)
    ctx.ui.select("Pick approach:", names)
    │
    ▼ ────────────────────── LLM TURN 3 (opus, ~5.5K input)
    Context: idea + chosen approach + Q&A + project
    Output: workflow_design({ spec: "..." })
    terminate: true → turn ends
    │
    ▼ ────────────────────── TUI (0 tokens)
    ctx.ui.editor("Review spec:", spec)
    user approves
    │
    ▼ ────────────────────── MECHANICAL (0 tokens)
    fs.writeFile(specPath, spec)
    git add + commit
    │
    ▼ ────────────────────── LLM TURN 4 (sonnet, ~5K input)
    Context: spec + project
    Output: workflow_plan({ plan: "..." })
    terminate: true → turn ends
    │
    ▼ ────────────────────── MECHANICAL (0 tokens)
    fs.writeFile(planPath, plan)
    git add + commit
    │
    ▼ ────────────────────── EXECUTION (subagents, isolated context)
    Each subagent: fresh context per task
    No accumulated history
```

## Total: 4 LLM Turns × ~5K Input Each = ~20K tokens

vs. Traditional: 12-15 turns × growing context = ~262K tokens

**Savings: ~92%**

---

## Critical Mechanism: Context Stripping

The `context` event handler is what prevents history accumulation:

```typescript
pi.on("context", async (event, _ctx) => {
  if (!workflow?.isActive()) return;
  
  // Only keep the last user message (the one with compressed context)
  // Strip everything else — the LLM doesn't need prior turns
  const messages = event.messages;
  const lastUserIdx = messages.findLastIndex(
    m => m.type === "message" && m.message.role === "user"
  );
  
  if (lastUserIdx > 0) {
    return { messages: messages.slice(lastUserIdx) };
  }
});
```

This is the key trick: each LLM turn sees ONLY:
1. System prompt (~2K)
2. The last injected message with compressed context (~3-5K)
3. Nothing else

No growing conversation. No accumulated tool results. No "let me read the tree again."

---

## Notes & Gotchas

1. **`setTimeout(() => pi.sendUserMessage(...), 100)`** — Needed because tools can't trigger
   the next turn synchronously during execution. The small delay lets the current turn
   finalize before injecting the next message.

2. **`terminate: true`** — Essential. Without it, the LLM would continue generating text
   after calling the tool, wasting tokens and potentially calling other tools.

3. **`pi.appendEntry()`** — State survives session restart. If user closes pi mid-workflow,
   it can resume (would need a `/workflow-resume` command or auto-detect on session_start).

4. **`ctx.ui.editor()` for spec review** — Shows the full spec in a scrollable editor.
   User can edit inline to give feedback, or leave unchanged to approve.

5. **Model switching happens in tool execute** — Before triggering the next sendUserMessage,
   we switch models. The next turn uses the new model automatically.

6. **Execution phase exits orchestration** — Once state is EXECUTE, the `context` event
   stops stripping messages. The LLM operates normally for subagent dispatch.
