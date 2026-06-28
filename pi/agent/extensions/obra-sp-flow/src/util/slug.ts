/** Slug/run-id helpers. */

export function slugify(input: string): string {
	const base = input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return base || "task";
}

export function utcStamp(date = new Date()): string {
	return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

export function makeRunId(request: string, date = new Date()): string {
	return `${utcStamp(date)}-${slugify(request)}`;
}
