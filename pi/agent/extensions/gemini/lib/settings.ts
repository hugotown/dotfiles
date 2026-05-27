// Loads gemini/config.yml into { keymap, theme }, merging each section over its
// defaults. A missing file or section falls back entirely to defaults. The result is
// cached: the form panel (theme) and the TAB trigger (keymap) both read it.
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { type KeymapConfig, mergeKeymap } from "./keymap";
import { mergeLayout, type PanelLayout } from "./layout";
import { mergeTheme, type ThemeColors } from "./theme";

export interface AppConfig {
  keymap: KeymapConfig;
  theme: ThemeColors;
  panel: PanelLayout;
}

export function parseConfig(yamlText: string): AppConfig {
  const raw = (parseYaml(yamlText) ?? {}) as {
    keymap?: Partial<KeymapConfig>;
    theme?: Partial<ThemeColors>;
    panel?: Partial<PanelLayout>;
  };
  return { keymap: mergeKeymap(raw.keymap), theme: mergeTheme(raw.theme), panel: mergeLayout(raw.panel) };
}

let cached: AppConfig | null = null;

/** Read config.yml (cached); fall back entirely to defaults if missing or invalid. */
export function getConfig(): AppConfig {
  if (cached) return cached;
  try {
    const path = fileURLToPath(new URL("../config.yml", import.meta.url));
    cached = parseConfig(fs.readFileSync(path, "utf-8"));
  } catch {
    cached = parseConfig("");
  }
  return cached;
}
