// handlers/select.ts — AnswerType for single-select questions
import { Type } from "typebox";
import type { AnswerType, BaseQuestion, Answer, SubViewCtx, SubView } from "../types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { optionPicker } from "../ui/option-picker.ts";

export const selectType: AnswerType = {
	type: "select",
	fields: {
		options: Type.Optional(
			Type.Array(
				Type.Object({
					label: Type.String(),
					description: Type.Optional(Type.String()),
				}),
			),
		),
		default: Type.Optional(Type.String()),
	},

	initial(q: BaseQuestion): Answer {
		return (q["default"] as string | undefined) ?? "";
	},

	display(q: BaseQuestion, answer: Answer, theme: Theme): string {
		const val = typeof answer === "string" ? answer.trim() : "";
		return val ? val : theme.fg("dim", "(sin responder)");
	},

	open(c: SubViewCtx, q: BaseQuestion, current: Answer, done: (a: Answer) => void, cancel: () => void): SubView {
		return optionPicker(c, q, current, done, cancel, { multi: false, wireframe: false });
	},

	toText(_q: BaseQuestion, answer: Answer): string {
		return typeof answer === "string" ? answer || "(no answer)" : "(no answer)";
	},
};
