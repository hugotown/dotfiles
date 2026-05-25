// Loads config.yml into { keymap, theme, panel }, merging each section over its defaults.
// Missing file or section falls back to defaults (Tokyo Night theme). parseConfig is pure.
import * as fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { type KeymapConfig, mergeKeymap } from "./keymap.ts";
import { mergeTheme, type ThemeColors } from "./theme.ts";

/** Overlay sizing. listMargin is the percent of the terminal left blank on EACH side for the
 * workflows list overlay (so it spans the central (100 - 2*listMargin)% square, centered). */
export interface PanelConfig {
	width: string | number;
	minWidth: number;
	maxHeight: string | number;
	listMargin: number;
}

export interface AppConfig {
	keymap: KeymapConfig;
	theme: ThemeColors;
	panel: PanelConfig;
}

const DEFAULT_PANEL: PanelConfig = { width: "85%", minWidth: 48, maxHeight: "85%", listMargin: 10 };

function mergePanel(raw: Partial<PanelConfig> | undefined): PanelConfig {
	return { ...DEFAULT_PANEL, ...(raw ?? {}) };
}

export function parseConfig(yamlText: string): AppConfig {
	const raw = (parseYaml(yamlText) ?? {}) as {
		keymap?: Partial<KeymapConfig>;
		theme?: Partial<ThemeColors>;
		panel?: Partial<PanelConfig>;
	};
	return { keymap: mergeKeymap(raw.keymap), theme: mergeTheme(raw.theme), panel: mergePanel(raw.panel) };
}

/** Read config.yml; fall back entirely to defaults if it is missing or invalid. */
export function loadConfig(path: string): AppConfig {
	try {
		return parseConfig(fs.readFileSync(path, "utf-8"));
	} catch {
		return parseConfig("");
	}
}
