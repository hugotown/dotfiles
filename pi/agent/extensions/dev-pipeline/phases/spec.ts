import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { specPrompt, specReviewPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { PipelineState } from "../state.ts";

export function specPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "design");
}

export async function startSpec(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "📝 spec");
	if (!(await applyPhaseConfig(pi, ctx, "SPEC"))) return;
	drivePhase(pi, specPrompt(s, specPathFor(s)));
}

/** Returns true if the spec file is valid (advance to self-review), false to halt (NFR-2). */
export async function onSpecEnd(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<boolean> {
	const path = specPathFor(s);
	if (!(await artifactIsValid(pi, path))) {
		ctx.ui.notify("Spec phase produced no file — halting pipeline (NFR-2).", "error");
		return false;
	}
	return true;
}

export async function startSpecReview(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🔎 spec self-review");
	if (!(await applyPhaseConfig(pi, ctx, "SPEC_SELF_REVIEW"))) return;
	drivePhase(pi, specReviewPrompt(specPathFor(s)));
}
