// handlers/multiselect.ts — AnswerType for multi-select questions
import { Type } from "typebox";
import type { AnswerType, BaseQuestion, Answer, SubViewCtx, SubView } from "../types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { optionPicker } from "../ui/option-picker.ts";

export const multiselectType: AnswerType = {
	type: "multiselect",
	fields: {
		options: Type.Array(
			Type.Object({
				label: Type.String(),
				description: Type.String({
					description: "REQUIRED. Detailed explanation of what choosing this option means and its tradeoffs.",
				}),
			}),
		),
		default: Type.Array(Type.String(), {
			description: "REQUIRED. Labels of the recommended pre-checked options (use an empty array if none are recommended).",
		}),
	},

	initial(q: BaseQuestion): Answer {
		const d = q["default"];
		return Array.isArray(d) ? (d as string[]) : [];
	},

	display(q: BaseQuestion, answer: Answer, theme: Theme): string {
		const arr = Array.isArray(answer) ? answer : [];
		return arr.length > 0 ? arr.join(", ") : theme.fg("dim", "(sin responder)");
	},

	open(c: SubViewCtx, q: BaseQuestion, current: Answer, done: (a: Answer) => void, cancel: () => void): SubView {
		return optionPicker(c, q, current, done, cancel, { multi: true, wireframe: false });
	},

	toText(_q: BaseQuestion, answer: Answer): string {
		const arr = Array.isArray(answer) ? answer : [];
		return arr.length > 0 ? arr.join(", ") : "(no answer)";
	},
};
