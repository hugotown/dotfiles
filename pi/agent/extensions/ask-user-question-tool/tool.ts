// tool.ts — thin registration; schema built from registry, execute delegates to form + result
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { buildQuestionsSchema } from "./registry.ts";
import { showQuestionsForm } from "./ui/form.ts";
import { buildToolText, formatAnswer } from "./result.ts";
import { getType } from "./registry.ts";

export { buildToolText } from "./result.ts";

export function registerAskUserQuestion(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "ask_user_question",
		label: "Ask User Question",
		description:
			"Present the user with assumptions you inferred plus structured questions, and RETURN their answers. " +
			"EVERY question MUST be self-explanatory for a non-expert: fill `context` with a rich explanation in the user's language covering WHAT is asked, WHY it matters / what it affects, HOW the answer is used, WHEN/WHERE it applies, and a short flow of what must be decided (several sentences, do not be terse). " +
			"EVERY question MUST also include a pre-selected recommendation (`default`) and a thorough `reasoning` explaining WHY that recommendation, with its tradeoffs. " +
			"For option-based types, EVERY option MUST have a detailed `description` of what choosing it means and its tradeoffs. " +
			"Question types: 'select' (one of several options; `default` = recommended option label), 'multiselect' (choose several; `default` = array of recommended option labels, may be empty), 'text' (free input; `default` = recommended pre-filled answer), 'wireframe_select' (select with an optional ASCII wireframe per option in the `wireframe` string array), and 'color_palette' (when the decision is a color; offer `presets` as {name, hex} objects and/or let the user type a custom hex; `default` = recommended hex). " +
			"Set done=true once you have enough to proceed.",
		parameters: Type.Object({
			title: Type.String({ description: "REQUIRED. Short topic shown in the form header." }),
			done: Type.Boolean({ description: "True if you have enough information to proceed after this round." }),
			assumptions: Type.Array(
				Type.Object({
					id: Type.String(),
					text: Type.String(),
					confidence: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
				}),
				{ minItems: 1, description: "REQUIRED. State at least one assumption you inferred." },
			),
			questions: buildQuestionsSchema(),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const assumptions = (params.assumptions ?? []) as import("./types.ts").Assumption[];
			const questions = (params.questions ?? []) as import("./types.ts").BaseQuestion[];
			if (!ctx.hasUI) {
				const answers = questions.map((q) => {
					const handler = getType(q.type);
					const ans = handler ? handler.initial(q) : (q["default"] as import("./types.ts").Answer ?? "");
					return { question: q.label, answer: formatAnswer(q, ans) };
				});
				return {
					content: [{ type: "text" as const, text: buildToolText({ kind: "answers", answers, comments: "", note: "No interactive UI; recommended defaults were used." }) }],
					details: undefined,
				};
			}
			const form = await showQuestionsForm(ctx, assumptions, questions, params.title ?? "Questions");
			if (form.cancelled) return { content: [{ type: "text" as const, text: buildToolText({ kind: "cancelled" }) }], details: undefined };
			const answers = questions.map((q) => ({ question: q.label, answer: formatAnswer(q, form.answers[q.id] ?? "") }));
			return {
				content: [{ type: "text" as const, text: buildToolText({ kind: "answers", answers, comments: form.comments }) }],
				details: { answers, comments: form.comments },
			};
		},
	});
}
