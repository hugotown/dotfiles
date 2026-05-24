import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { BRAINSTORM_DONE_MARKER, brainstormContinuePrompt, brainstormPrompt } from "../lib/prompts.ts";
import { sanitizeSlug } from "../lib/paths.ts";
import type { PipelineEvent, PipelineState } from "../state.ts";

/**
 * Safety net only: caps how many times the orchestrator re-arms the brainstorm after a turn
 * ended without the double-OK close. It does NOT cap the number of questions or rounds the
 * model asks within a turn — that is unbounded by design (the user drives it).
 */
export const MAX_BRAINSTORM_ROUNDS = 12;

/** Drive the brainstorm turn: the LLM probes the repo, then gathers every decision via ask_user_question. */
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
	// questionRound > 0 means a prior turn ended without closing — re-enter with the shorter
	// continuation prompt (the full Q&A dialogue is retained, brainstorm is exempt from filtering).
	const prompt = s.questionRound === 0 ? brainstormPrompt(s) : brainstormContinuePrompt();
	drivePhase(pi, prompt);
}

/**
 * The brainstorm turn ended. The model gathered the user's answers via the ask_user_question
 * tool and, when BOTH it and the user had no remaining doubts, closed with a "## Decisions"
 * summary terminated by the BRAINSTORM_DONE marker — that summary is the handoff to the spec.
 *
 * If the close marker is absent, the model stopped early: re-arm another brainstorm round
 * (QUESTION_ROUND) until it closes, capped by MAX_BRAINSTORM_ROUNDS as an anti-hang safety net.
 */
export async function onBrainstormEnd(
	_pi: ExtensionAPI,
	ctx: ExtensionContext,
	s: PipelineState,
	lastAssistantText: string,
): Promise<PipelineEvent> {
	const text = lastAssistantText.trim();
	const markerLine = new RegExp(`^\\s*${BRAINSTORM_DONE_MARKER}\\s*$`, "m");
	const slug = sanitizeSlug(s.activity);

	if (markerLine.test(text)) {
		const decisions = text.replace(markerLine, "").trim() || s.decisions;
		return { type: "PROCEED", decisions, slug };
	}

	if (s.questionRound + 1 >= MAX_BRAINSTORM_ROUNDS) {
		ctx.ui.notify(
			`Brainstorm did not close after ${MAX_BRAINSTORM_ROUNDS} rounds — proceeding with the decisions gathered so far.`,
			"warning",
		);
		return { type: "PROCEED", decisions: text || s.decisions, slug };
	}

	return { type: "QUESTION_ROUND" };
}
