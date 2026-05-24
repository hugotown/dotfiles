// handlers/color-palette.ts — AnswerType for color_palette questions
import { Type } from "typebox";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { AnswerType, BaseQuestion, Answer, SubViewCtx, SubView } from "../types.ts";
import { swatch, hexToRgb } from "../ui/swatch.ts";
import { renderSwatchList, getPresets } from "../ui/swatch-list-render.ts";

export const colorPaletteType: AnswerType = {
	type: "color_palette",
	fields: {
		presets: Type.Optional(Type.Array(Type.Object({ name: Type.String(), hex: Type.String() }))),
		default: Type.Optional(Type.String()),
	},

	initial(q: BaseQuestion): Answer {
		return (q["default"] as string | undefined) ?? "";
	},

	display(q: BaseQuestion, answer: Answer, theme): string {
		const hex = typeof answer === "string" ? answer.trim() : "";
		if (!hex) return theme.fg("dim", "(sin elegir)");
		return `${swatch(hex)} ${hex}`;
	},

	open(c: SubViewCtx, q: BaseQuestion, current: Answer, done: (a: Answer) => void, cancel: () => void): SubView {
		const { theme } = c;
		const presets = getPresets(q);
		const customIdx = presets.length;
		let cursor = 0;
		let editMode = false;
		const editor = c.makeEditor();

		const curHex = typeof current === "string" ? current.trim() : "";
		const found = presets.findIndex((p) => p.hex.toLowerCase() === curHex.toLowerCase());
		if (found >= 0) cursor = found;

		editor.onSubmit = (text: string) => {
			const v = text.trim();
			if (hexToRgb(v) !== null) { done(v.startsWith("#") ? v : `#${v}`); }
			else { editor.setText(""); c.refresh(); }
		};

		return {
			render: (width: number) => renderSwatchList(editMode, cursor, presets, theme, editor, width),
			handleInput(data: string): void {
				if (editMode) {
					if (matchesKey(data, Key.escape)) { editMode = false; editor.setText(""); c.refresh(); return; }
					editor.handleInput(data); c.refresh(); return;
				}
				if (matchesKey(data, Key.escape)) { cancel(); return; }
				const total = presets.length + 1;
				if (matchesKey(data, Key.up)) { cursor = Math.max(0, cursor - 1); c.refresh(); return; }
				if (matchesKey(data, Key.down)) { cursor = Math.min(total - 1, cursor + 1); c.refresh(); return; }
				if (matchesKey(data, Key.enter)) {
					if (cursor === customIdx) { editMode = true; c.refresh(); }
					else { const p = presets[cursor]; if (p) done(p.hex); }
				}
			},
		};
	},

	toText(_q: BaseQuestion, answer: Answer): string {
		const hex = typeof answer === "string" ? answer.trim() : "";
		return hex || "(none)";
	},
};
