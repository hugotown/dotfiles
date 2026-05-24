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
			"Present the user with assumptions you inferred plus structured questions, and RETURN their answers. Question types: 'select' (one of several options, each with a recommended default + reasoning, optionally an ASCII wireframe per option in the `wireframe` string array), 'multiselect' (choose several), 'text' (free input), 'wireframe_select' (select with ASCII wireframe), and 'color_palette' (when the decision is a color; offer `presets` as {name, hex} objects and/or let the user type a custom hex). Always provide a recommended `default` and a one-line `reasoning` per question. The user can also leave free-form comments. Set done=true once you have enough to proceed.",
		parameters: Type.Object({
			title: Type.Optional(Type.String({ description: "Short topic shown in the form header." })),
			done: Type.Boolean({ description: "True if you have enough information to proceed after this round." }),
			assumptions: Type.Optional(
				Type.Array(
					Type.Object({
						id: Type.String(),
						text: Type.String(),
						confidence: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
					}),
				),
			),
			questions: Type.Optional(buildQuestionsSchema()),
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
