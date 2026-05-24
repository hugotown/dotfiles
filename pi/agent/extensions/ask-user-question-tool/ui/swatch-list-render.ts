// ui/swatch-list-render.ts — render logic for the color-palette sub-view (split for line limit)
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { BaseQuestion } from "../types.ts";
import { swatch } from "./swatch.ts";

export interface Preset { name: string; hex: string }

export const DEFAULT_PALETTE: Preset[] = [
	{ name: "Azul", hex: "#1e88e5" },
	{ name: "Verde", hex: "#43a047" },
	{ name: "Rojo", hex: "#e53935" },
	{ name: "Naranja", hex: "#fb8c00" },
	{ name: "Morado", hex: "#8e24aa" },
	{ name: "Cian", hex: "#00acc1" },
	{ name: "Negro", hex: "#212121" },
	{ name: "Blanco", hex: "#f5f5f5" },
];

export function getPresets(q: BaseQuestion): Preset[] {
	return (q["presets"] as Preset[] | undefined) ?? DEFAULT_PALETTE;
}

export function renderSwatchList(
	editMode: boolean,
	cursor: number,
	presets: Preset[],
	theme: Theme,
	editor: { render(w: number): string[] },
	width: number,
): string[] {
	const lines: string[] = [];
	const add = (s: string) => lines.push(truncateToWidth(s, width));
	const customIdx = presets.length;

	if (editMode) {
		add(theme.fg("muted", " Introduce un color #rrggbb:"));
		for (const l of editor.render(width - 2)) add(` ${l}`);
		lines.push("");
		add(theme.fg("dim", " Enter para confirmar · Esc volver a paleta"));
		return lines;
	}

	for (let i = 0; i < presets.length; i++) {
		const p = presets[i];
		const sel = i === cursor;
		const prefix = sel ? theme.fg("accent", "> ") : "  ";
		const label = sel
			? theme.fg("accent", `${p.name}  ${p.hex}`)
			: theme.fg("text", `${p.name}  ${p.hex}`);
		add(`${prefix}${swatch(p.hex)} ${label}`);
	}
	// custom row
	const cSel = cursor === customIdx;
	const cPrefix = cSel ? theme.fg("accent", "> ") : "  ";
	add(`${cPrefix}${theme.fg(cSel ? "accent" : "muted", "✎ Custom hex…")}`);
	lines.push("");
	add(theme.fg("dim", " ↑↓ navegar · Enter seleccionar · Esc volver"));
	return lines;
}
