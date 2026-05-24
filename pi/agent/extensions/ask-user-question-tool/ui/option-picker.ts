// ui/option-picker.ts — shared sub-view for option-based questions (select / multiselect / wireframe)
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { SubView, SubViewCtx, BaseQuestion, Answer } from "../types.ts";
import type { ThemeLike } from "./wireframe.ts";
import { getOpts, renderPickerLines } from "./option-picker-render.ts";

export interface PickerOptions {
	multi: boolean;
	wireframe: boolean;
}

export function optionPicker(
	c: SubViewCtx,
	q: BaseQuestion,
	current: Answer,
	done: (a: Answer) => void,
	cancel: () => void,
	opts: PickerOptions,
): SubView {
	const { theme } = c;
	const themeLike: ThemeLike = { fg: (col, t) => theme.fg(col as Parameters<typeof theme.fg>[0], t), bold: (t) => theme.bold(t) };
	const realOpts = getOpts(q);
	const typeIdx = realOpts.length;
	const nextIdx = realOpts.length + 1;

	let optionIndex = 0;
	let editMode = false;
	const checked = new Set<number>();
	const editor = c.makeEditor();

	if (opts.multi) {
		const cur = Array.isArray(current) ? current : [];
		realOpts.forEach((o, i) => { if (cur.includes(o.label)) checked.add(i); });
	} else {
		const curLabel = typeof current === "string" ? current : "";
		const si = realOpts.findIndex((o) => o.label === curLabel);
		if (si >= 0) optionIndex = si;
	}

	editor.onSubmit = (text: string) => {
		const v = text.trim();
		if (opts.multi) {
			if (v) { const prev = Array.isArray(current) ? [...current] : []; if (!prev.includes(v)) prev.push(v); done(prev); }
			editMode = false; editor.setText(""); c.refresh();
		} else {
			if (v) { done(v); } else { editMode = false; editor.setText(""); c.refresh(); }
		}
	};

	function render(width: number): string[] {
		return renderPickerLines(editMode, optionIndex, checked, opts.multi, opts.wireframe, realOpts, theme, themeLike, q, editor, width);
	}

	function handleInput(data: string): void {
		if (editMode) {
			if (matchesKey(data, Key.escape)) { editMode = false; editor.setText(""); c.refresh(); return; }
			editor.handleInput(data); c.refresh(); return;
		}
		if (matchesKey(data, Key.escape)) { cancel(); return; }

		const totalItems = opts.multi ? realOpts.length + 2 : realOpts.length + 1;
		if (matchesKey(data, Key.up)) { optionIndex = Math.max(0, optionIndex - 1); c.refresh(); return; }
		if (matchesKey(data, Key.down)) { optionIndex = Math.min(totalItems - 1, optionIndex + 1); c.refresh(); return; }

		if (opts.multi && matchesKey(data, Key.space)) {
			if (optionIndex < realOpts.length) { checked.has(optionIndex) ? checked.delete(optionIndex) : checked.add(optionIndex); c.refresh(); }
			return;
		}

		if (matchesKey(data, Key.enter)) {
			if (opts.multi) {
				if (optionIndex === typeIdx) { editMode = true; c.refresh(); }
				else if (optionIndex === nextIdx) {
					const sel = realOpts.filter((_, i) => checked.has(i)).map((o) => o.label);
					const prev = Array.isArray(current) ? current : [];
					const custom = prev.filter((l) => !realOpts.some((o) => o.label === l));
					done([...sel, ...custom]);
				} else { checked.has(optionIndex) ? checked.delete(optionIndex) : checked.add(optionIndex); c.refresh(); }
			} else {
				if (optionIndex === typeIdx) { editMode = true; c.refresh(); }
				else { const o = realOpts[optionIndex]; if (o) done(o.label); }
			}
		}
	}

	return { render, handleInput };
}
