import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { applyPhaseConfig, sendPhasePrompt, restoreDefaults } from "./orchestrator.ts";
import { buildProjectContext, hasGraphify } from "./context-builder.ts";
import { buildResearchPrompt } from "./prompts/research.ts";
import { buildApproachesPrompt } from "./prompts/approaches.ts";
import { buildDesignPrompt } from "./prompts/design.ts";
import { buildPlanPrompt } from "./prompts/plan.ts";
import { buildExecutionMessage } from "./prompts/execution.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function driveCurrentPhase(
  state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "GATHERING_CONTEXT": {
      ctx.ui.setStatus("draft-ptb", "📦 gathering context...");
      const compressed = await buildProjectContext(pi, ctx.cwd);
      await advance(ctx, { type: "CONTEXT_READY", compressedContext: compressed });
      break;
    }
    case "RESEARCH": {
      ctx.ui.setStatus("draft-ptb", "🔬 research");
      if (!await applyPhaseConfig(pi, ctx, "RESEARCH")) { await advance(ctx, { type: "RESET" }); return; }
      const graphify = await hasGraphify(pi, ctx.cwd);
      sendPhasePrompt(pi, buildResearchPrompt(state, graphify));
      break;
    }
    case "APPROACHES": {
      ctx.ui.setStatus("draft-ptb", "🎯 approaches");
      if (!await applyPhaseConfig(pi, ctx, "APPROACHES")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildApproachesPrompt(state));
      break;
    }
    case "DESIGN": {
      ctx.ui.setStatus("draft-ptb", "✏️ design");
      if (!await applyPhaseConfig(pi, ctx, "DESIGN")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildDesignPrompt(state));
      break;
    }
    case "PLAN": {
      ctx.ui.setStatus("draft-ptb", "📋 plan");
      if (!await applyPhaseConfig(pi, ctx, "PLAN")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildPlanPrompt(state));
      break;
    }
    case "COMPLETE": {
      ctx.ui.setStatus("draft-ptb", undefined);
      await restoreDefaults(pi, ctx, state);
      ctx.ui.notify(`✅ draft-ptb complete!\n  Spec: ${state.specPath}\n  Plan: ${state.planPath}`, "info");
      const choice = await ctx.ui.select("What next?", ["Execute the plan (subagent-driven)", "Done for now"]);
      if (choice?.startsWith("Execute")) {
        pi.sendMessage(
          { customType: "draft-ptb-execute", content: buildExecutionMessage(state), display: true },
          { triggerTurn: true },
        );
      }
      break;
    }
    case "IDLE": {
      ctx.ui.setStatus("draft-ptb", undefined);
      await restoreDefaults(pi, ctx, state);
      break;
    }
  }
}
