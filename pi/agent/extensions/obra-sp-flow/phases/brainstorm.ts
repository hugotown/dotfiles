// Step 1 — the design phase, run as a code-driven node machine:
//   grounding (deterministic) -> questions (controller, ask-only) -> stories -> spec.
// Grounding is now 100% deterministic (filesystem inspection only — no LLM, no
// child pi): it builds a tree, detects the stack, and reads key manifests/configs.
// The questions node runs in the controller (ask_user_question needs the UI) but
// has NO exploration tools — it relies on that understanding and asks when something
// is missing. Stories generates Given/When/Then acceptance criteria from the resolved
// ledger. The harness owns transitions, persistence, compression, and progress
// feedback; the model only creates.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { applyPhaseConfig, persist, sendPhasePrompt } from "../orchestrator.ts";
import { loadCore } from "../lib/cores.ts";
import { rulesBlock } from "../lib/rules.ts";
import { announce, working } from "../lib/progress.ts";
import { type RecordMetric } from "../lib/metrics.ts";
import { type BrainstormScratch, initBrainstormScratch } from "./brainstorm/types.ts";
import { applyOutcome, parseAskOutcome, renderLedger } from "./brainstorm/ledger.ts";
import { applyUserDoubt, questionsStep } from "./brainstorm/conductor.ts";
import { runGroundingDeterministic } from "./brainstorm/grounding.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

// Grounding is deterministic (no LLM). Questions (controller): ask ONLY — no
// exploration in the controller, so nothing noisy renders. Stories: generate
// Given/When/Then acceptance criteria. Spec: commit the doc (+ read) without
// re-exploring.
const QUESTIONS_TOOLS = ["ask_user_question"];
const STORIES_TOOLS = ["obra_stories"];
const SPEC_TOOLS = ["obra_spec", "read"];

function bs(state: FlowState): BrainstormScratch | undefined {
  return state.scratch.brainstorm as BrainstormScratch | undefined;
}

function understandingBlock(state: FlowState): string {
  const u = bs(state)?.repoUnderstanding?.trim();
  return u ? `## Repo understanding (from grounding — trust this)\n${u}\n\n---\n` : "";
}

function questionsPrompt(state: FlowState): string {
  return [
    loadCore("brainstorming"),
    "\n---\n",
    understandingBlock(state),
    "## Brainstorm — questions node",
    `Idea: ${state.idea}`,
    "Resolve EVERY ambiguity through ask_user_question. You have NO exploration tools here — rely on the repo understanding above; if something is missing, ASK rather than assume.",
    "Declare safe inferences as `assumptions` (with confidence); ask only what genuinely blocks the design. One concern at a time.",
    "When you have NO more SUBSTANTIVE questions, set done=true — do NOT add a closing 'anything else? / ¿algo más?' question; the harness already asks the user about remaining doubts. Never write the spec or ask for approval here.",
    rulesBlock(state.config.phases.brainstorm.rules),
  ].join("\n");
}

function specPrompt(state: FlowState): string {
  const cov = state.config.limits.coverageThreshold;
  const ledger = renderLedger(bs(state) ?? initBrainstormScratch());
  const stories = bs(state)?.userStories ?? "";
  return [
    loadCore("brainstorming"),
    "\n---\n",
    understandingBlock(state),
    "## Brainstorm — spec node",
    `Idea: ${state.idea}`,
    "All ambiguity is resolved. Write the design spec from the decision ledger and user stories below.",
    "",
    ledger || "(no decisions recorded)",
    "",
    stories ? `## User Stories (acceptance criteria — include verbatim in the spec)\n${stories}\n` : "",
    `Call obra_spec(intent, title, spec). The spec MUST include a '## Decisions & Resolved Ambiguities' section reproducing the ledger, a '## Acceptance Criteria' section with the user stories (Given/When/Then), plus architecture, components, data flow, error handling, and the test strategy (unit/integration/e2e, coverage > ${cov}%).`,
    rulesBlock(state.config.phases.brainstorm.rules),
  ].join("\n");
}

/** Node 1 — deterministic grounding. Filesystem inspection only (no LLM, no
 *  child pi). Builds tree + detects stack + reads manifests/configs, then
 *  advances to the questions node. Runs in milliseconds. */
function runGrounding(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext): void {
  announce(pi, { icon: "🧠", text: "Inspeccionando el codebase (determinístico)…" });
  working(ctx, "🧠 Inspeccionando estructura del proyecto…");

  const result = runGroundingDeterministic({ cwd: ctx.cwd, idea: state.idea });

  const s = bs(state);
  if (s) {
    s.repoUnderstanding = result.summary;
    s.node = "questions";
  }
  persist(pi, state);
  working(ctx); // restore default indicator
  announce(pi, { icon: "📋", text: `Contexto listo (${result.stack.primary}${result.stack.framework ? "/" + result.stack.framework : ""}) — empezando las preguntas` });
}

async function startQuestions(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<boolean> {
  // Model + thinking come from the brainstorm_questions node config (falls back to
  // brainstorm). Use a cheap model + low thinking here: grounding did the heavy work.
  if (!(await applyPhaseConfig(pi, ctx, state, "brainstorm_questions", QUESTIONS_TOOLS))) return false;
  announce(pi, { icon: "💬", text: "Resolviendo dudas hasta cero ambigüedad" });
  sendPhasePrompt(pi, questionsPrompt(state));
  return true;
}

function storiesPrompt(state: FlowState): string {
  const ledger = renderLedger(bs(state) ?? initBrainstormScratch());
  return [
    loadCore("brainstorming"),
    "\n---\n",
    understandingBlock(state),
    "## Brainstorm — stories node",
    `Idea: ${state.idea}`,
    "All ambiguity is resolved. Generate user stories with acceptance criteria in Given/When/Then (Gherkin) format.",
    "",
    ledger || "(no decisions recorded)",
    "",
    "Write user stories that cover:",
    "- The primary user flow (happy path)",
    "- Key edge cases and error scenarios identified in the decision ledger",
    "- Each story must follow: 'As a <role>, I want <goal>, so that <benefit>'",
    "- Each story must have at least one scenario with Given/When/Then clauses",
    "",
    "Call obra_stories(stories) with the complete set of user stories in markdown.",
    rulesBlock(state.config.phases.brainstorm.rules),
  ].join("\n");
}

async function startStories(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<boolean> {
  const s = bs(state);
  if (s) s.node = "stories";
  persist(pi, state);
  if (!(await applyPhaseConfig(pi, ctx, state, "brainstorm_stories", STORIES_TOOLS))) return false;
  announce(pi, { icon: "📖", text: "Generando historias de usuario con criterios de aceptación" });
  sendPhasePrompt(pi, storiesPrompt(state));
  return true;
}

async function startSpec(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<boolean> {
  const s = bs(state);
  if (s) s.node = "spec";
  persist(pi, state);
  if (!(await applyPhaseConfig(pi, ctx, state, "brainstorm_spec", SPEC_TOOLS))) return false;
  announce(pi, { icon: "📐", text: "Sin dudas pendientes — redactando el spec" });
  sendPhasePrompt(pi, specPrompt(state));
  return true;
}

export async function driveBrainstorm(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Brainstorm needs an interactive UI.", "error");
    await advance(ctx, { type: "RESET" });
    return;
  }
  state.scratch.brainstorm = initBrainstormScratch();
  persist(pi, state);
  await runGrounding(state, pi, ctx);
  if (!(await startQuestions(state, pi, ctx))) await advance(ctx, { type: "RESET" });
}

/** tool_result hook: fold each ask_user_question round into the ledger + feedback.
 *  On done=true we cut the turn (ctx.abort): ask_user_question has no `terminate`,
 *  so otherwise the model keeps re-calling it with empty questions in a loop. The
 *  abort ends the turn cleanly, which fires agent_end -> the user-doubt gate. */
export function handleBrainstormToolResult(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, toolName: string, input: unknown, details: unknown): void {
  const s = bs(state);
  if (!s || s.node !== "questions" || toolName !== "ask_user_question") return;
  const outcome = parseAskOutcome(input, details);
  state.scratch.brainstorm = applyOutcome(s, outcome);
  persist(pi, state);
  const rounds = (state.scratch.brainstorm as BrainstormScratch).rounds;
  announce(pi, { icon: "📝", text: `Ronda ${rounds}: ${outcome.qa.length} resuelto(s)${outcome.done ? " · el modelo no tiene más dudas" : ""}` });
  if (outcome.done) ctx.abort();
}

/** agent_end hook: advance the brainstorm node machine (the conductor). */
export async function handleBrainstormEnd(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  const s = bs(state);
  if (!s) return;
  if (s.node === "questions") {
    if (questionsStep(s) === "ask-again") {
      sendPhasePrompt(pi, questionsPrompt(state));
      return;
    }
    // user-gate: the user may still have doubts (0-token, in the main UI).
    const doubt = await ctx.ui.input("¿Algún tema o duda tuya antes de pasar al diseño? (Enter si todo está claro)");
    if (doubt && doubt.trim()) {
      state.scratch.brainstorm = applyUserDoubt(s, doubt);
      persist(pi, state);
      announce(pi, { icon: "💬", text: "Tomo tu tema y sigo resolviéndolo" });
      sendPhasePrompt(pi, questionsPrompt(state));
      return;
    }
    // Transition: questions -> stories (not directly to spec)
    await startStories(state, pi, ctx);
    return;
  }
  if (s.node === "stories") {
    if (state.scratch.storiesReady) {
      // Stories committed — advance to spec
      await startSpec(state, pi, ctx);
    } else {
      // Stories rejected by validation — re-prompt
      sendPhasePrompt(pi, storiesPrompt(state));
    }
    return;
  }
  if (s.node === "spec") {
    if (state.scratch.specReady) {
      await advance(ctx, { type: "BRAINSTORM_DONE", specPath: String(state.scratch.specPath), intent: String(state.scratch.intent ?? "") });
    } else {
      sendPhasePrompt(pi, specPrompt(state));
    }
  }
  // grounding / done: the controller isn't driving a turn — nothing to do here.
}
