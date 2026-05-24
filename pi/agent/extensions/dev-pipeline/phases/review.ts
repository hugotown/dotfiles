import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { reviewPrompt } from "../lib/prompts.ts";
import type { PipelineState } from "../state.ts";

export async function startReview(pi: ExtensionAPI, ctx: ExtensionContext, _s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🧐 code review");
	if (!(await applyPhaseConfig(pi, ctx, "REVIEW"))) return;
	drivePhase(pi, reviewPrompt());
}

/** Extract the verdict from the review reply (used only to record state, not for control flow gating). */
export function parseVerdict(text: string): "APPROVED" | "CHANGES_REQUIRED" {
	return /verdict:\s*approved/i.test(text) ? "APPROVED" : "CHANGES_REQUIRED";
}
