import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { brainstormPrompt } from "../lib/prompts.ts";
import { sanitizeSlug } from "../lib/paths.ts";
import type { PipelineEvent, PipelineState } from "../state.ts";

/** Drive the brainstorm turn: the LLM uses the ask_user_question tool to gather decisions. */
export async function startBrainstorm(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	ctx.ui.setStatus("dev-pipeline", "🧠 brainstorm");
	// Defense-in-depth: the interactive form lives in the sibling ask-user-question-tool
	// extension. If it isn't loaded, warn — brainstorm still works but falls back to prose.
	if (!pi.getAllTools().some((t) => t.name === "ask_user_question")) {
		ctx.ui.notify(
			"dev-pipeline: the 'ask_user_question' tool is not registered — enable the ask-user-question-tool extension for the interactive brainstorm form.",
			"warning",
		);
	}
	if (!(await applyPhaseConfig(pi, ctx, "BRAINSTORM"))) return;
	drivePhase(pi, brainstormPrompt(s));
}

/**
 * The brainstorm turn ended. The LLM gathered the user's answers via the ask_user_question
 * tool (the interactive form is shown inside that tool, NFR-3 handoff) and summarized them.
 * Its final "## Decisions" text is the handoff to the spec phase.
 */
export async function onBrainstormEnd(
	_pi: ExtensionAPI,
	_ctx: ExtensionContext,
	s: PipelineState,
	lastAssistantText: string,
): Promise<PipelineEvent> {
	const decisions = lastAssistantText.trim() || s.decisions;
	const slug = sanitizeSlug(s.activity);
	return { type: "PROCEED", decisions, slug };
}
