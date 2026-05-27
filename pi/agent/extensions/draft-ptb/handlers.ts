import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { saveSpec, savePlan } from "./file-ops.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function handleAgentEnd(
  state: DraftState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "RESEARCH": {
      if (state.answers.length === 0) return;
      await advance(ctx, { type: "ANSWERS_COLLECTED", answers: state.answers });
      break;
    }

    case "APPROACHES": {
      if (state.approaches.length === 0) return;
      ctx.ui.notify(`Recommendation: ${state.recommendation}`, "info");
      const choice = await ctx.ui.select(
        "Pick an approach:",
        state.approaches.map((a) => `${a.name}: ${a.description}`),
      );
      const idx = state.approaches.findIndex((a) => choice?.startsWith(a.name));
      const chosen = state.approaches[idx >= 0 ? idx : 0];
      await advance(ctx, { type: "APPROACH_CHOSEN", approach: chosen });
      break;
    }

    case "DESIGN": {
      if (!state.spec) return;
      const feedback = await ctx.ui.editor(
        "Review the spec (edit to provide feedback, or leave unchanged to approve):",
        state.spec,
      );
      const approved = !feedback?.trim() || feedback.trim() === state.spec.trim();
      if (approved) {
        const specPath = await saveSpec(pi, ctx, state);
        await advance(ctx, { type: "SPEC_APPROVED", specPath });
      } else {
        await advance(ctx, { type: "SPEC_REVISION_REQUESTED", feedback: feedback! });
      }
      break;
    }

    case "PLAN": {
      if (!state.plan) return;
      const planPath = await savePlan(pi, ctx, state);
      await advance(ctx, { type: "PLAN_SAVED", planPath });
      break;
    }
  }
}
