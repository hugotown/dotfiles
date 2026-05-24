import { expect, test } from "bun:test";
import { compressContext, MAX_CONTEXT_CHARS } from "../context/compress.ts";

test("short content passes through unchanged", () => {
	const out = compressContext({ tree: "a\nb", stack: "deps: x", probes: "ast_grep=false graphify=false" });
	expect(out).toContain("a\nb");
	expect(out).toContain("deps: x");
	expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
});

test("oversized content is truncated to the char cap with a marker", () => {
	const huge = "x".repeat(MAX_CONTEXT_CHARS * 2);
	const out = compressContext({ tree: huge, stack: "deps: y", probes: "p" });
	expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
	expect(out).toContain("[truncated]");
	// Highest-priority sections (stack, probes) survive truncation.
	expect(out).toContain("deps: y");
	expect(out).toContain("p");
});
