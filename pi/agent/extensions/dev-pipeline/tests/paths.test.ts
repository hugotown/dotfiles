import { expect, test } from "bun:test";
import { artifactFolderFor, sanitizeSlug, dateStamp, artifactPath } from "../lib/paths.ts";

test("artifactFolderFor strips /Users/ and maps / to _", () => {
	const folder = artifactFolderFor("/Users/hugoruiz/work/Developer/x", "/Users/hugoruiz/obsidian-home");
	expect(folder).toBe("/Users/hugoruiz/obsidian-home/obsidian/Documents/hugoruiz_work_Developer_x");
});

test("artifactFolderFor handles cwd not under /Users", () => {
	const folder = artifactFolderFor("/srv/repo", "/home/me");
	expect(folder).toBe("/home/me/obsidian/Documents/srv_repo");
});

test("sanitizeSlug lowercases and keeps only [a-z0-9-]", () => {
	expect(sanitizeSlug("My Cool Feature!! v2")).toBe("my-cool-feature-v2");
	expect(sanitizeSlug("  Leading/Trailing  ")).toBe("leading-trailing");
	expect(sanitizeSlug("__weird___name__")).toBe("weird-name");
});

test("sanitizeSlug falls back to 'feature' when empty", () => {
	expect(sanitizeSlug("!!!")).toBe("feature");
});

test("dateStamp returns YYYY-MM-DD", () => {
	expect(dateStamp(new Date("2026-05-23T10:00:00Z"))).toBe("2026-05-23");
});

test("artifactPath joins folder/date-slug-type.md", () => {
	expect(artifactPath("/a/b", "2026-05-23", "my-feature", "design")).toBe(
		"/a/b/2026-05-23-my-feature-design.md",
	);
});
