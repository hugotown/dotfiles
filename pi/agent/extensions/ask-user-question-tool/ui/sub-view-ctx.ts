// ui/sub-view-ctx.ts — builds a SubViewCtx from the raw TUI/Theme
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { SubViewCtx } from "../types.ts";

function buildEditorTheme(theme: Theme): EditorTheme {
	return {
		borderColor: (s) => theme.fg("accent", s),
		selectList: getSelectListTheme(),
	};
}

export function makeSubViewCtx(tui: TUI, theme: Theme, refresh: () => void): SubViewCtx {
	return {
		tui,
		theme,
		makeEditor() {
			return new Editor(tui, buildEditorTheme(theme), { paddingX: 1 });
		},
		refresh,
	};
}
