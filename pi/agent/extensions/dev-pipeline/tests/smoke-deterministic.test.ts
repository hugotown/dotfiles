import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { gatherContext, type ExecFn } from "../context/gather.ts";
import { compressContext, MAX_CONTEXT_CHARS } from "../context/compress.ts";
import { artifactFolderFor } from "../lib/paths.ts";

const realExec: ExecFn = (command, args) =>
	new Promise((resolve) => {
		execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
		});
	});

test("smoke: deterministic path on a tiny sample repo", async () => {
	const repo = mkdtempSync(join(tmpdir(), "pipe-"));
	mkdirSync(join(repo, "node_modules", "junk"), { recursive: true });
	mkdirSync(join(repo, "src"), { recursive: true });
	writeFileSync(join(repo, "src", "index.ts"), "export const x = 1;\n");
	writeFileSync(
		join(repo, "package.json"),
		JSON.stringify({ name: "sample", dependencies: { left: "1.0.0" }, scripts: { test: "bun test" } }),
	);

	const gathered = await gatherContext(realExec, repo);
	// FR-6: excluded dirs omitted from the tree.
	expect(gathered.tree).not.toContain("node_modules");
	// FR-7: compressed stack signal only.
	expect(gathered.stack).toContain("sample");
	expect(gathered.stack).toContain("left");
	expect(gathered.stack).not.toContain("1.0.0");

	const compressed = compressContext({ stack: gathered.stack, probes: gathered.probes, tree: gathered.tree });
	// FR-9: within the char budget.
	expect(compressed.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);

	// FR-5: folder mangling.
	const folder = artifactFolderFor("/Users/me/work/x", "/Users/me");
	expect(folder).toBe("/Users/me/obsidian/Documents/me_work_x");
});
