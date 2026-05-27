// Overlay size for the Gemini flag panel, with built-in defaults. Pure (no I/O); config.yml
// loading lives in settings.ts. width/maxHeight accept absolute columns/rows (number) or a
// percentage string of the terminal (e.g. "60%"); minWidth is a column floor.
import type { SizeValue } from "@earendil-works/pi-tui";

export interface PanelLayout {
  width: SizeValue;
  minWidth: number;
  maxHeight: SizeValue;
}

export const DEFAULT_LAYOUT: PanelLayout = { width: "80%", minWidth: 48, maxHeight: "80%" };

export function mergeLayout(raw: Partial<PanelLayout> | undefined): PanelLayout {
  return { ...DEFAULT_LAYOUT, ...(raw ?? {}) };
}
