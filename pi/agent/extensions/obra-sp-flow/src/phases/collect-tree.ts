/**
 * Phase 1 · step 1 — collect-tree (deterministic, no LLM).
 *
 * Golden rule: getting the repo tree is a single command-verifiable result, so no LLM.
 * Runs `eza --tree --level=<depth> --git-ignore` (eza is a hard dep checked in Phase 0)
 * and persists the tree as grounding for the later LLM steps (context-extract/brainstorm).
 * The output is clipped to a line cap so a huge tree never bloats the artifact/prompt.
 */
import { CollectTreeContract } from "../contracts/grounding.ts";
import type { Phase, RunContext } from "../types/phase.ts";

const TREE_BIN = "eza";
export const MAX_TREE_LINES = 4000;

/** Clip a tree to `maxLines`, appending a marker when truncated. */
export function clipTree(text: string, maxLines: number): { treeText: string; truncated: boolean } {
	const trimmed = text.replace(/\s+$/, "");
	if (trimmed === "") return { treeText: "", truncated: false };
	const all = trimmed.split("\n");
	if (all.length <= maxLines) return { treeText: all.join("\n"), truncated: false };
	const omitted = all.length - maxLines;
	const marker = `… (${omitted} more line${omitted === 1 ? "" : "s"} truncated)`;
	return { treeText: `${all.slice(0, maxLines).join("\n")}\n${marker}`, truncated: true };
}

async function runCollectTree(rc: RunContext): Promise<Record<string, unknown>> {
	const depth = rc.config.collectTree.depth;
	rc.feedback.tick(`collect-tree: ${TREE_BIN} --tree --level=${depth} --git-ignore`);

	const r = await rc.exec(TREE_BIN, ["--tree", `--level=${depth}`, "--git-ignore"]);
	if (r.code !== 0) {
		return {
			verdict: "block",
			blockers: [`${TREE_BIN} --tree failed (exit ${r.code}): ${r.stderr.trim() || "no stderr"}`],
			tool: TREE_BIN,
			depth,
			treeText: "",
			lines: 0,
			truncated: false,
		};
	}

	const { treeText, truncated } = clipTree(r.stdout, MAX_TREE_LINES);
	const lines = treeText === "" ? 0 : treeText.split("\n").length;
	return { verdict: "pass", blockers: [], tool: TREE_BIN, depth, treeText, lines, truncated };
}

export const collectTreePhase: Phase = {
	id: "collect-tree",
	index: 1,
	title: "Collect repo tree (eza --tree)",
	kind: "deterministic",
	contract: CollectTreeContract,
	run: runCollectTree,
};
