// handlers/text.ts — AnswerType for free-text questions
import { Type } from "typebox";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { AnswerType, BaseQuestion, Answer, SubViewCtx, SubView } from "../types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";

export const textType: AnswerType = {
	type: "text",
	fields: {
		default: Type.String({ description: "REQUIRED. Recommended pre-filled answer." }),
	},

	initial(q: BaseQuestion): Answer {
		return (q["default"] as string | undefined) ?? "";
	},

	display(q: BaseQuestion, answer: Answer, theme: Theme): string {
		const val = typeof answer === "string" ? answer.trim() : "";
		return val ? val : theme.fg("dim", "(sin responder)");
	},

	open(c: SubViewCtx, q: BaseQuestion, current: Answer, done: (a: Answer) => void, cancel: () => void): SubView {
		const { theme } = c;
		const editor = c.makeEditor();
		editor.setText(typeof current === "string" ? current : "");
		editor.onSubmit = (text: string) => { done(text.trim()); };

		return {
			render(width: number): string[] {
				const lines: string[] = [];
				lines.push(theme.fg("muted", " Tu respuesta:"));
				for (const l of editor.render(width - 2)) lines.push(` ${l}`);
				lines.push("");
				lines.push(theme.fg("dim", " Enter para guardar · Esc volver"));
				return lines;
			},
			handleInput(data: string): void {
				if (matchesKey(data, Key.escape)) { cancel(); return; }
				editor.handleInput(data);
				c.refresh();
			},
		};
	},

	toText(_q: BaseQuestion, answer: Answer): string {
		return typeof answer === "string" ? answer || "(no answer)" : "(no answer)";
	},
};
