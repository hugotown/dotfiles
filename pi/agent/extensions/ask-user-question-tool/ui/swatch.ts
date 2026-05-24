// ui/swatch.ts — render a hex color as a truecolor block (real color in the terminal)

/** Parse #rrggbb → [r,g,b] or null if invalid. */
export function hexToRgb(hex: string): [number, number, number] | null {
	const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
	if (!m) return null;
	const n = Number.parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A 2-cell colored block for `hex`, or two spaces if hex is invalid. */
export function swatch(hex: string): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return "  ";
	return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m  \x1b[0m`;
}
