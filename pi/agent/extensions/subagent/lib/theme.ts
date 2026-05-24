// Panel color set. Defaults are the official Tokyo Night palette
// (agent/themes/tokyo-night.json); config.yml's `theme:` overrides any subset.

export interface ThemeColors {
	panelBg: string;
	selectedBg: string;
	fg: string;
	muted: string;
	dim: string;
	blue: string;
	green: string;
	red: string;
	yellow: string;
}

export const DEFAULT_THEME: ThemeColors = {
	panelBg: "#16161e",
	selectedBg: "#292e42",
	fg: "#c0caf5",
	muted: "#565f89",
	dim: "#737aa2",
	blue: "#7aa2f7",
	green: "#9ece6a",
	red: "#f7768e",
	yellow: "#e0af68",
};

export function mergeTheme(raw: Partial<ThemeColors> | undefined): ThemeColors {
	return { ...DEFAULT_THEME, ...(raw ?? {}) };
}
