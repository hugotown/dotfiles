// Zips pre-sized left/right column lines into full-width rows. Pure + testable.
// Width math lives in the renderers (they pad/truncate plain text before coloring),
// so this only concatenates; ANSI color codes are zero-width and stay aligned.

export function joinColumns(left: string[], right: string[], height: number, leftWidth: number, gap: string): string[] {
	const rows: string[] = [];
	for (let i = 0; i < height; i++) {
		const l = left[i] ?? " ".repeat(leftWidth);
		const r = right[i] ?? "";
		rows.push(l + gap + r);
	}
	return rows;
}
