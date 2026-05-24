// Pure 24-bit truecolor painting helpers + width padding. Color values come from the
// resolved ThemeColors (lib/theme.ts), loaded from config.yml. fg/bg reset only their
// own channel, so wrapping a padded line in bg() yields a solid, opaque background.
// Verbatim from subagent (daddy is standalone, design §3).

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
