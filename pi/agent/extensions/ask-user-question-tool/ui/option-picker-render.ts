// ui/option-picker-render.ts — render logic for option-picker (split for line limit)
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { BaseQuestion } from "../types.ts";
import { renderWireframe, type ThemeLike } from "./wireframe.ts";

export interface Opt {
	label: string;
	description?: string;
	wireframe?: string[];
}

export function getOpts(q: BaseQuestion): Opt[] {
	return (q["options"] as Opt[] | undefined) ?? [];
}

function isRecommended(q: BaseQuestion, label: string, multi: boolean): boolean {
	const d = q["default"];
	if (multi) return Array.isArray(d) && (d as string[]).includes(label);
	return typeof d === "string" && d === label;
}

export function renderPickerOpt(
	opt: Opt,
	idx: number,
	selected: boolean,
	checked: boolean | undefined,
	theme: Theme,
	add: (s: string) => void,
	themeLike: ThemeLike,
	showWireframe: boolean,
	q: BaseQuestion,
	recommended: boolean,
	width: number,
): void {
	const prefix = selected ? theme.fg("accent", "> ") : "  ";
	const checkMark = checked !== undefined ? (checked ? theme.fg("accent", "[x] ") : "[ ] ") : "";
	const recTag = recommended ? theme.fg("success", " (recomendado)") : "";
	const labelLines = wrapTextWithAnsi(`${idx + 1}. ${opt.label}`, Math.max(8, width - 4));
	labelLines.forEach((l, i) => {
		const colored = selected ? theme.fg("accent", l) : theme.fg("text", l);
		add(i === 0 ? prefix + checkMark + colored + recTag : `    ${colored}`);
	});
	// Full description only for the highlighted option to keep the form compact.
	if (selected && opt.description) {
		for (const l of wrapTextWithAnsi(opt.description, Math.max(8, width - 5))) add(`     ${theme.fg("dim", l)}`);
	}
	if (showWireframe && selected) {
		const wf = (q["options"] as Opt[] | undefined)?.[idx]?.wireframe;
		if (wf?.length) for (const l of renderWireframe(wf, themeLike)) add(`     ${l}`);
	}
}

export function renderPickerLines(
	editMode: boolean,
	optionIndex: number,
	checked: Set<number>,
	multi: boolean,
	wireframe: boolean,
	realOpts: Opt[],
	theme: Theme,
	themeLike: ThemeLike,
	q: BaseQuestion,
	editor: { render(w: number): string[] },
	width: number,
): string[] {
	const lines: string[] = [];
	const add = (s: string) => lines.push(truncateToWidth(s, width));
	const typeIdx = realOpts.length;

	if (editMode) {
		add(theme.fg("muted", multi ? " Añadir opción personalizada:" : " Tu respuesta:"));
		for (const l of editor.render(width - 2)) add(` ${l}`);
		lines.push("");
		add(theme.fg("dim", " Enter para guardar · Esc volver a opciones"));
		return lines;
	}

	const displayOpts: Opt[] = [...realOpts, { label: "Type something." }];
	if (multi) displayOpts.push({ label: "✓ Next" });

	for (let i = 0; i < displayOpts.length; i++) {
		const opt = displayOpts[i];
		const sel = i === optionIndex;
		const isReal = i < realOpts.length;
		const rec = isReal ? isRecommended(q, opt.label, multi) : false;
		renderPickerOpt(opt, i, sel, multi && isReal ? checked.has(i) : undefined, theme, add, themeLike, wireframe && i === optionIndex && i !== typeIdx, q, rec, width);
	}

	lines.push("");
	const hint = multi
		? " ↑↓ navegar · Space activar · Enter en Next confirmar · Esc volver"
		: " ↑↓ navegar · Enter seleccionar · Esc volver";
	add(theme.fg("dim", hint));
	return lines;
}
