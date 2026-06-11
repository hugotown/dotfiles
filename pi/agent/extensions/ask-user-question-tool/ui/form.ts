// ui/form.ts — ctx.ui.custom shell: sections, navigation, sub-view delegation
import { Key, matchesKey, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Assumption, BaseQuestion, QuestionsFormResult, SubView } from "../types.ts";
import { getType } from "../registry.ts";
import { makeSubViewCtx } from "./sub-view-ctx.ts";
import { renderQuestionsSection } from "./questions-list.ts";

type Section = "questions" | "send";

function sectionLabel(s: Section): string {
	if (s === "questions") return "Preguntas";
	return "Enviar";
}

export async function showQuestionsForm(
	ctx: ExtensionContext,
	assumptions: Assumption[],
	questions: BaseQuestion[],
	requestTitle: string,
): Promise<QuestionsFormResult> {
	return ctx.ui.custom<QuestionsFormResult>((tui, theme, _kb, done) => {
		const answers: Record<string, import("../types.ts").Answer> = {};
		for (const q of questions) {
			const handler = getType(q.type);
			answers[q.id] = handler ? handler.initial(q) : "";
		}

		let section: Section = "questions";
		let questionCursor = 0;
		let subView: SubView | null = null;
		let cachedLines: string[] | undefined;

		const refresh = () => { cachedLines = undefined; tui.requestRender(); };
		const svCtx = makeSubViewCtx(tui, theme, refresh);

		function toggleSection() {
			section = section === "questions" ? "send" : "questions";
			refresh();
		}

		function openSubView(q: BaseQuestion) {
			const handler = getType(q.type);
			if (!handler) return;
			subView = handler.open(svCtx, q, answers[q.id] ?? handler.initial(q),
				(a) => { answers[q.id] = a; subView = null; refresh(); },
				() => { subView = null; refresh(); },
			);
			refresh();
		}

		function handleInput(data: string) {
			if (subView) { subView.handleInput(data); return; }
			if (matchesKey(data, Key.escape)) {
				if (section !== "questions") { section = "questions"; refresh(); }
				else done({ answers: {}, comments: "", cancelled: true });
				return;
			}
			if (matchesKey(data, Key.tab)) { toggleSection(); return; }
			if (matchesKey(data, Key.shift("tab"))) { toggleSection(); return; }
			if (section === "questions") {
				if (questions.length === 0) return;
				if (matchesKey(data, Key.up)) { questionCursor = Math.max(0, questionCursor - 1); refresh(); }
				else if (matchesKey(data, Key.down)) { questionCursor = Math.min(questions.length - 1, questionCursor + 1); refresh(); }
				else if (matchesKey(data, Key.enter)) { const q = questions[questionCursor]; if (q) openSubView(q); }
			} else {
				if (matchesKey(data, Key.enter)) done({ answers, comments: "", cancelled: false });
			}
		}

		function render(width: number): string[] {
			if (subView) {
				const q = questions[questionCursor];
				const lines: string[] = [];
				const add = (s: string) => lines.push(truncateToWidth(s, width));
				const pushWrapped = (text: string, indent: number) => {
					const pad = " ".repeat(indent);
					for (const l of wrapTextWithAnsi(text, Math.max(8, width - indent))) lines.push(pad + l);
				};
				add(theme.fg("accent", "─".repeat(width)));
				if (q) {
					pushWrapped(theme.fg("accent", theme.bold(q.label)), 1);
					if (q.context) { lines.push(""); pushWrapped(theme.fg("text", q.context), 1); }
					if (q.reasoning) { lines.push(""); pushWrapped(theme.fg("muted", "Por qué se recomienda: ") + theme.fg("dim", q.reasoning), 1); }
				}
				lines.push("");
				for (const l of subView.render(width)) lines.push(truncateToWidth(l, width));
				add(theme.fg("accent", "─".repeat(width)));
				return lines;
			}
			if (cachedLines) return cachedLines;
			const lines: string[] = [];
			const add = (s: string) => lines.push(truncateToWidth(s, width));
			add(theme.fg("accent", "─".repeat(width)));
			add(theme.fg("accent", theme.bold(` ${requestTitle}`)));
			const nextLabel = section === "questions" ? "Enviar" : "Preguntas";
			add(theme.fg("dim", ` Sección: ${sectionLabel(section)}  (Tab → ${nextLabel})`));
			lines.push("");
			if (section === "questions") {
				for (const l of renderQuestionsSection(width, theme, assumptions, questions, answers, questionCursor)) lines.push(l);
			} else {
				lines.push(""); add(theme.fg("success", " ✓ Enviar respuestas")); lines.push("");
				add(theme.fg("dim", " Enter para enviar · Tab/Shift+Tab → Preguntas · Esc volver"));
				add(theme.fg("accent", "─".repeat(width)));
			}
			cachedLines = lines;
			return lines;
		}

		return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
	}); }
