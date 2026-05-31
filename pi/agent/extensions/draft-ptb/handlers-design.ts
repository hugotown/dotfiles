// Handlers for approaches, design, and plan phases (agent_end events).

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { saveSpec, savePlan } from "./file-ops.ts";
import { formatApproachesWidget } from "./prompts/format.ts";

export const APPROACHES_WIDGET_KEY = "draft-ptb-approaches";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function handleApproachesEnd(state: DraftState, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (state.approaches.length === 0) return;
  ctx.ui.setWidget(APPROACHES_WIDGET_KEY, formatApproachesWidget(state.approaches, state.recommendation), { placement: "aboveEditor" });
  const labels = state.approaches.map((a, i) => {
    const letter = String.fromCharCode(65 + i);
    const star = state.recommendation === a.name ? " ⭐" : "";
    return `${letter} — ${a.name}${star}`;
  });
  const choice = await ctx.ui.select("Pick an approach (details above):", labels);
  const idx = labels.findIndex((l) => l === choice);
  await advance(ctx, { type: "APPROACH_CHOSEN", approach: state.approaches[idx >= 0 ? idx : 0] });
}

export async function handleDesignEnd(state: DraftState, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (!state.spec) return;
  const feedback = await ctx.ui.editor("Review the spec (edit to provide feedback, or leave unchanged to approve):", state.spec);
  const approved = !feedback?.trim() || feedback.trim() === state.spec.trim();
  if (approved) {
    await advance(ctx, { type: "SPEC_APPROVED", specPath: await saveSpec(ctx, state) });
  } else {
    await advance(ctx, { type: "SPEC_REVISION_REQUESTED", feedback: feedback! });
  }
}

export async function handlePlanEnd(state: DraftState, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (!state.plan) return;
  await advance(ctx, { type: "PLAN_SAVED", planPath: await savePlan(ctx, state) });
}
