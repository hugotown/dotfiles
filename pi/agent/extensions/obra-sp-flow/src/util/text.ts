/** Small pure text helpers shared across the codebase. */

/** Collapse whitespace and clip to `max` chars with an ellipsis. */
export function shorten(s: string, max: number): string {
	const one = s.replace(/\s+/g, " ").trim();
	return one.length > max ? `${one.slice(0, max)}…` : one;
}

/** Keep only the trailing `max` chars (used for command output tails). */
export function tail(text: string, max = 600): string {
	const t = text.trimEnd();
	return t.length > max ? `…${t.slice(-max)}` : t;
}

/** Collapse whitespace and clip to `max` chars (no leading ellipsis). */
export function compact(s: string, max = 220): string {
	const one = s.replace(/\s+/g, " ").trim();
	return one.length > max ? `${one.slice(0, max)}…` : one;
}
