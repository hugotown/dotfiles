// ui/questions-list.ts — renders the questions section of the main form
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Assumption, BaseQuestion, Answer } from "../types.ts";
import { getType } from "../registry.ts";

export function renderQuestionsSection(
	width: number,
	theme: Theme,
	assumptions: Assumption[],
	questions: BaseQuestion[],
	answers: Record<string, Answer>,
	cursor: number,
): string[] {
	const lines: string[] = [];
	const add = (s: string) => lines.push(truncateToWidth(s, width));
	const pushWrapped = (text: string, indent: number) => {
		const pad = " ".repeat(indent);
		for (const l of wrapTextWithAnsi(text, Math.max(8, width - indent))) lines.push(pad + l);
	};

	if (assumptions.length > 0) {
		add(theme.fg("muted", " Supuestos:"));
		for (const a of assumptions) {
			const icon =
				a.confidence === "high"
					? theme.fg("success", "✓")
					: a.confidence === "medium"
						? theme.fg("warning", "~")
						: theme.fg("error", "?");
			pushWrapped(`${icon} ${a.text}${theme.fg("dim", ` (${a.confidence})`)}`, 1);
		}
		lines.push("");
	}

	if (questions.length === 0) {
		add(theme.fg("dim", " (sin preguntas)"));
	} else {
		for (let i = 0; i < questions.length; i++) {
			const q = questions[i];
			const sel = i === cursor;
			const labelLines = wrapTextWithAnsi(theme.fg(sel ? "accent" : "text", q.label), Math.max(8, width - 2));
			labelLines.forEach((l, j) => add((j === 0 ? (sel ? theme.fg("accent", "❯ ") : "  ") : "  ") + l));
			const ans = answers[q.id];
			const handler = getType(q.type);
			const display = handler ? handler.display(q, ans ?? handler.initial(q), theme) : String(ans ?? "");
			pushWrapped(`${theme.fg("muted", "→ ")}${display}`, 4);
			if (sel) {
				lines.push("");
				if (q.context) pushWrapped(theme.fg("text", q.context), 4);
				if (q.reasoning) {
					lines.push("");
					pushWrapped(theme.fg("muted", "Por qué se recomienda: ") + theme.fg("dim", q.reasoning), 4);
				}
				lines.push("");
			}
		}
	}

	lines.push("");
	add(theme.fg("dim", " ↑↓ pregunta · Enter responder · Tab → Enviar · Esc cancelar"));
	add(theme.fg("accent", "─".repeat(width)));
	return lines;
}
