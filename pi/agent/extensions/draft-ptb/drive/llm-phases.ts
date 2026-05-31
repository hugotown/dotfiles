// LLM-driven phases: research, completeness, approaches, design, plan.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "../state.ts";
import { applyPhaseConfig, sendPhasePrompt } from "../orchestrator.ts";
import { detectProject, buildProjectTree, hasGraphify } from "../context/index.ts";
import { buildResearchPrompt } from "../prompts/research.ts";
import { buildCompletenessPrompt } from "../prompts/completeness.ts";
import { buildApproachesPrompt } from "../prompts/approaches.ts";
import { buildDesignPrompt } from "../prompts/design.ts";
import { buildPlanPrompt } from "../prompts/plan.ts";
import { APPROACHES_WIDGET_KEY } from "../handlers.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function driveGatheringContext(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "📦 detectando proyecto...");
  const { projectInfo, gitInfo } = await detectProject(pi, ctx.cwd, state.featureFolder);
  const tree = await buildProjectTree(pi, ctx.cwd);
  await advance(ctx, { type: "PROJECT_DETECTED", projectInfo, gitInfo, tree });
}

export async function driveResearch(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🔬 research");
  if (!await applyPhaseConfig(pi, ctx, "RESEARCH")) { await advance(ctx, { type: "RESET" }); return; }
  const graphify = await hasGraphify(pi, ctx.cwd);
  sendPhasePrompt(pi, buildResearchPrompt(state, graphify));
}

export async function driveCompleteness(pi: ExtensionAPI, ctx: ExtensionContext, state: DraftState, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "✅ completeness check");
  if (!await applyPhaseConfig(pi, ctx, "COMPLETENESS_CHECK")) { await advance(ctx, { type: "RESET" }); return; }
  sendPhasePrompt(pi, buildCompletenessPrompt(state));
}

export async function driveApproaches(pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, state: DraftState): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🎯 approaches");
  if (!await applyPhaseConfig(pi, ctx, "APPROACHES")) { await advance(ctx, { type: "RESET" }); return; }
  sendPhasePrompt(pi, buildApproachesPrompt(state));
}

export async function driveDesign(pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, state: DraftState): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "✏️ design");
  ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
  if (!await applyPhaseConfig(pi, ctx, "DESIGN")) { await advance(ctx, { type: "RESET" }); return; }
  sendPhasePrompt(pi, buildDesignPrompt(state));
}

export async function drivePlan(pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, state: DraftState): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "📋 plan");
  if (!await applyPhaseConfig(pi, ctx, "PLAN")) { await advance(ctx, { type: "RESET" }); return; }
  sendPhasePrompt(pi, buildPlanPrompt(state));
}
