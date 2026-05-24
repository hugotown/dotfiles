import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, artifactIsValid, drivePhase } from "../orchestrator.ts";
import { notesPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp } from "../lib/paths.ts";
import type { PipelineState } from "../state.ts";

export function notesPathFor(s: PipelineState): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", "implementation");
}

export async function startNotes(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🗒️ notes");
	if (!(await applyPhaseConfig(pi, ctx, "NOTES"))) return;
	drivePhase(pi, notesPrompt(s, notesPathFor(s), s.reviewVerdict ?? "UNKNOWN"));
}

export async function notesFileValid(pi: ExtensionAPI, s: PipelineState): Promise<boolean> {
	return artifactIsValid(pi, notesPathFor(s));
}
