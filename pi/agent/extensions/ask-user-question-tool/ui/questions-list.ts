// ui/questions-list.ts — renders the questions section of the main form
import { truncateToWidth } from "@earendil-works/pi-tui";
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

	if (assumptions.length > 0) {
		add(theme.fg("muted", " Supuestos:"));
		for (const a of assumptions) {
			const icon =
				a.confidence === "high"
					? theme.fg("success", "✓")
					: a.confidence === "medium"
						? theme.fg("warning", "~")
						: theme.fg("error", "?");
			add(` ${icon} ${a.text}${theme.fg("dim", ` (${a.confidence})`)}`);
		}
		lines.push("");
	}

	if (questions.length === 0) {
		add(theme.fg("dim", " (sin preguntas)"));
	} else {
		for (let i = 0; i < questions.length; i++) {
			const q = questions[i];
			const sel = i === cursor;
			const prefix = sel ? theme.fg("accent", "❯ ") : "  ";
			add(prefix + theme.fg(sel ? "accent" : "text", q.label));
			const ans = answers[q.id];
			const handler = getType(q.type);
			const display = handler ? handler.display(q, ans ?? handler.initial(q), theme) : String(ans ?? "");
			add(`    ${theme.fg("muted", "→ ")}${display}`);
			if (sel && q.reasoning) add(`    ${theme.fg("dim", q.reasoning)}`);
			if (sel) lines.push("");
		}
	}

	lines.push("");
	add(theme.fg("dim", " ↑↓ pregunta · Enter responder · Tab → Comentarios · Esc cancelar"));
	add(theme.fg("accent", "─".repeat(width)));
	return lines;
}
