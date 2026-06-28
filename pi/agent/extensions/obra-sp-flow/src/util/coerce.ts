/** Defensive coercions for loosely-typed LLM payloads. */

export function asArray<T = unknown>(v: unknown): T[] {
	return Array.isArray(v) ? (v as T[]) : [];
}

export function asString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

export function uniq<T>(items: T[]): T[] {
	return [...new Set(items)];
}
