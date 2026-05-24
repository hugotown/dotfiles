// Loads config.yml into { keymap, theme }, merging each section over its defaults.
// Missing file or section falls back to defaults (Tokyo Night theme). parseConfig is pure.
import * as fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { type KeymapConfig, mergeKeymap } from "./keymap.ts";
import { mergeTheme, type ThemeColors } from "./theme.ts";

export interface AppConfig {
	keymap: KeymapConfig;
	theme: ThemeColors;
}

export function parseConfig(yamlText: string): AppConfig {
	const raw = (parseYaml(yamlText) ?? {}) as { keymap?: Partial<KeymapConfig>; theme?: Partial<ThemeColors> };
	return { keymap: mergeKeymap(raw.keymap), theme: mergeTheme(raw.theme) };
}

/** Read config.yml; fall back entirely to defaults if it is missing or invalid. */
export function loadConfig(path: string): AppConfig {
	try {
		return parseConfig(fs.readFileSync(path, "utf-8"));
	} catch {
		return parseConfig("");
	}
}
