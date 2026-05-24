// ui/form.ts — ctx.ui.custom shell: sections, navigation, sub-view delegation
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Assumption, BaseQuestion, QuestionsFormResult, SubView } from "../types.ts";
import { getType } from "../registry.ts";
import { makeSubViewCtx } from "./sub-view-ctx.ts";
import { renderQuestionsSection } from "./questions-list.ts";

type Section = "questions" | "comments" | "send";

function sectionLabel(s: Section): string {
	if (s === "questions") return "Preguntas";
	if (s === "comments") return "Comentarios";
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

		const editorTheme: EditorTheme = { borderColor: (s) => theme.fg("accent", s), selectList: getSelectListTheme() };
		const commentsEditor = new Editor(tui, editorTheme, { paddingX: 1 });
		commentsEditor.disableSubmit = true;

		const refresh = () => { cachedLines = undefined; tui.requestRender(); };
		const svCtx = makeSubViewCtx(tui, theme, refresh);

		function nextSection() {
			section = section === "questions" ? "comments" : section === "comments" ? "send" : "questions";
			refresh();
		}
		function prevSection() {
			section = section === "questions" ? "send" : section === "comments" ? "questions" : "comments";
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
			if (matchesKey(data, Key.tab)) { nextSection(); return; }
			if (matchesKey(data, Key.shift("tab"))) { prevSection(); return; }
			if (section === "questions") {
				if (questions.length === 0) return;
				if (matchesKey(data, Key.up)) { questionCursor = Math.max(0, questionCursor - 1); refresh(); }
				else if (matchesKey(data, Key.down)) { questionCursor = Math.min(questions.length - 1, questionCursor + 1); refresh(); }
				else if (matchesKey(data, Key.enter)) { const q = questions[questionCursor]; if (q) openSubView(q); }
			} else if (section === "comments") {
				commentsEditor.handleInput(data); refresh();
			} else {
				if (matchesKey(data, Key.enter)) done({ answers, comments: commentsEditor.getText().trim(), cancelled: false });
			}
		}

		function render(width: number): string[] {
			if (subView) {
				const q = questions[questionCursor];
				const lines: string[] = [];
				const add = (s: string) => lines.push(truncateToWidth(s, width));
				add(theme.fg("accent", "─".repeat(width)));
				if (q) { add(theme.fg("accent", theme.bold(` ${q.label}`))); if (q.reasoning) add(theme.fg("dim", `  ${q.reasoning}`)); }
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
			const nextLabel = section === "questions" ? "Comentarios" : section === "comments" ? "Enviar" : "Preguntas";
			add(theme.fg("dim", ` Sección: ${sectionLabel(section)}  (Tab → ${nextLabel})`));
			lines.push("");
			if (section === "questions") {
				for (const l of renderQuestionsSection(width, theme, assumptions, questions, answers, questionCursor)) lines.push(l);
			} else if (section === "comments") {
				add(theme.fg("muted", " Comentarios (opcional):")); lines.push("");
				for (const l of commentsEditor.render(width - 2)) add(` ${l}`);
				lines.push(""); add(theme.fg("dim", " Tab → Enviar · Shift+Tab → Preguntas · Esc volver"));
				add(theme.fg("accent", "─".repeat(width)));
			} else {
				lines.push(""); add(theme.fg("success", " ✓ Enviar respuestas")); lines.push("");
				add(theme.fg("dim", " Enter para enviar · Tab → Preguntas · Shift+Tab → Comentarios · Esc volver"));
				add(theme.fg("accent", "─".repeat(width)));
			}
			cachedLines = lines;
			return lines;
		}

		return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
	}); }
