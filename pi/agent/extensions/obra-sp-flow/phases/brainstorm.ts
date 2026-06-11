// Step 1 — the ONLY interactive phase. Runs in the controller session so the
// model can interview the user via ask_user_question, then commits the spec via
// the obra_spec tool. The completeness gate lives in the prompt: no spec until
// zero ambiguity remains.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { applyPhaseConfig, sendPhasePrompt } from "../orchestrator.ts";
import { loadSkill } from "../lib/skill-loader.ts";
import { rulesBlock } from "../lib/rules.ts";
import { specPath } from "../lib/paths.ts";
import { phaseTools } from "../lib/tools.ts";
import { repoContextBlock } from "../lib/repo-context.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function prompt(state: FlowState, target: string, repoCtx: string): string {
  const skill = loadSkill(state.config.skillsDir, "brainstorming");
  const ast = loadSkill(state.config.skillsDir, "ast-grep");
  const cov = state.config.limits.coverageThreshold;
  return [
    skill, "\n---\n", ast, "\n---\n",
    ...(repoCtx ? [repoCtx, "\n---\n"] : []),
    "## obra-sp-flow brainstorm task",
    `Idea: ${state.idea}`,
    "1. Ground in the codebase FIRST with ast-grep + read (architecture, patterns, contracts).",
    "2. Classify the requirement intent (architecture | design | feature | bug | behavior).",
    "3. Ask EVERY clarifying question via ask_user_question, ONE at a time, until ZERO ambiguity remains. Ask 'can the DB be wiped?' when a database is involved. This is the ONLY interactive phase — resolve everything now; later phases cannot ask.",
    "4. Propose 2-3 approaches via ask_user_question and let the user choose.",
    `5. ONLY when ambiguity is zero, call obra_spec(intent, title, spec). The spec MUST include a '## Decisions & Resolved Ambiguities' section logging each Q&A, plus architecture, components, data flow, error handling, and the test strategy (unit/integration/e2e, coverage > ${cov}%).`,
    `Do NOT call obra_spec before asking everything. Spec target: ${target}`,
    rulesBlock(state.config.phases.brainstorm.rules),
  ].join("\n");
}

export async function driveBrainstorm(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Brainstorm needs an interactive UI.", "error");
    await advance(ctx, { type: "RESET" });
    return;
  }
  const ok = await applyPhaseConfig(pi, ctx, state, "brainstorm", phaseTools("brainstorm", state.config.phases.brainstorm.tools));
  if (!ok) {
    await advance(ctx, { type: "RESET" });
    return;
  }
  sendPhasePrompt(pi, prompt(state, specPath(ctx.cwd, state.idea), repoContextBlock(ctx.cwd)));
}

export async function handleBrainstormEnd(state: FlowState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (!state.scratch.specReady) return;
  await advance(ctx, { type: "BRAINSTORM_DONE", specPath: String(state.scratch.specPath), intent: String(state.scratch.intent ?? "") });
}
