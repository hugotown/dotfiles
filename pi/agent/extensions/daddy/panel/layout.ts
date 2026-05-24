// Pure rendering helpers shared by run/design render: status markers, opaque blanks,
// and a two-column join. Lines are built as plain text padded to width then painted over a
// solid bg (palette.ts), so the overlay is fully opaque (no see-through to the buffer).
import type { ThemeColors } from "../lib/theme.ts";
import type { Status } from "../types.ts";
import { bg } from "./palette.ts";

/** Status → [marker char, theme color key]. */
export const MARK: Record<Status, [string, keyof ThemeColors]> = {
	running: ["*", "yellow"],
	ok: ["+", "green"],
	failed: ["x", "red"],
	skipped: ["-", "dim"],
	pending: [".", "muted"],
};

/** An opaque full-width blank row in the panel background. */
export function blankRow(theme: ThemeColors, width: number): string {
	return bg(theme.panelBg, " ".repeat(width));
}

/** Zip pre-sized, already-opaque left/right column lines into full-width rows. */
export function joinColumns(left: string[], right: string[], height: number, gap: string): string[] {
	const rows: string[] = [];
	for (let i = 0; i < height; i++) rows.push((left[i] ?? "") + gap + (right[i] ?? ""));
	return rows;
}
