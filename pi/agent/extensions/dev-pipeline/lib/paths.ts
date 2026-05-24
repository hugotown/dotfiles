import { homedir } from "node:os";
import { join } from "node:path";

/**
 * FR-5: ~/obsidian/Documents/<abs-cwd with leading "/Users/" removed and "/"→"_">.
 * `home` is injectable for testing; defaults to the real home dir.
 */
export function artifactFolderFor(cwd: string, home: string = homedir()): string {
	const stripped = cwd.replace(/^\/Users\//, "").replace(/^\//, "");
	const mangled = stripped.replace(/\//g, "_");
	return join(home, "obsidian", "Documents", mangled);
}

/** FR-14: kebab-case, sanitized to [a-z0-9-]+; never empty. */
export function sanitizeSlug(raw: string): string {
	const slug = raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "feature";
}

export function dateStamp(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

export function artifactPath(folder: string, date: string, slug: string, type: string): string {
	return join(folder, `${date}-${slug}-${type}.md`);
}
