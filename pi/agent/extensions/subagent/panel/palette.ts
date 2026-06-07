// Pure 24-bit truecolor painting helpers + width padding. Color values come from the
// resolved ThemeColors (lib/theme.ts), loaded from config.yml. fg/bg reset only their
// own channel, so wrapping a padded line in bg() yields a solid, opaque background.

function rgb(hex: string): string {
	const n = Number.parseInt(hex.slice(1), 16);
	return `${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
}

export function fg(hex: string, text: string): string {
	return `\x1b[38;2;${rgb(hex)}m${text}\x1b[39m`;
}

export function bg(hex: string, text: string): string {
	return `\x1b[48;2;${rgb(hex)}m${text}\x1b[49m`;
}

export function bold(text: string): string {
	return `\x1b[1m${text}\x1b[22m`;
}

/** Pad (or ellipsis-truncate) plain text to an exact visual width. */
export function pad(text: string, width: number): string {
	if (text.length > width) return `${text.slice(0, Math.max(0, width - 1))}…`;
	return text + " ".repeat(width - text.length);
}

/**
 * Wrap text to `width` columns at word boundaries, preserving explicit newlines.
 * A single word longer than `width` is broken at character boundaries. Multiple
 * spaces collapse to one when wrapping. Returns an array of lines.
 */
export function wordWrap(text: string, width: number): string[] {
	if (text.length === 0) return [];
	const out: string[] = [];
	for (const hardLine of text.split("\n")) {
		if (hardLine.length <= width) {
			out.push(hardLine);
			continue;
		}
		const words = hardLine.split(/\s+/).filter((w) => w.length > 0);
		let current = "";
		for (const w of words) {
			if (w.length >= width) {
				// Flush current buffer, then dump the long word in width-sized chunks.
				if (current) {
					out.push(current);
					current = "";
				}
				for (let i = 0; i < w.length; i += width) out.push(w.slice(i, i + width));
				continue;
			}
			const candidate = current.length === 0 ? w : `${current} ${w}`;
			if (candidate.length > width) {
				out.push(current);
				current = w;
			} else {
				current = candidate;
			}
		}
		if (current) out.push(current);
	}
	return out;
}
