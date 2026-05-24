// ui/option-picker-render.ts — render logic for option-picker (split for line limit)
import { truncateToWidth } from "@earendil-works/pi-tui";
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
): void {
	const prefix = selected ? theme.fg("accent", "> ") : "  ";
	const checkMark = checked !== undefined ? (checked ? theme.fg("accent", "[x] ") : "[ ] ") : "";
	const label = selected ? theme.fg("accent", `${idx + 1}. ${opt.label}`) : theme.fg("text", `${idx + 1}. ${opt.label}`);
	add(prefix + checkMark + label);
	if (opt.description) add(`     ${theme.fg("dim", opt.description)}`);
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
		renderPickerOpt(opt, i, sel, multi && isReal ? checked.has(i) : undefined, theme, add, themeLike, wireframe && i === optionIndex && i !== typeIdx, q);
	}

	lines.push("");
	const hint = multi
		? " ↑↓ navegar · Space activar · Enter en Next confirmar · Esc volver"
		: " ↑↓ navegar · Enter seleccionar · Esc volver";
	add(theme.fg("dim", hint));
	return lines;
}
