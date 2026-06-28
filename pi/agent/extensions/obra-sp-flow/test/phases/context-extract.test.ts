import { describe, expect, it } from "bun:test";
import { validateContract } from "../../src/contracts/base.ts";
import { ContextExtractContract } from "../../src/contracts/grounding.ts";
import { CONTEXT_EXTRACT_TEMPLATE, contextExtractPhase } from "../../src/phases/context-extract.ts";
import { FALLBACK } from "../../src/config/defaults.ts";
import type { RunContext } from "../../src/types/phase.ts";

function mkRc(request: string, readArtifact: (id: string) => unknown): RunContext {
	return {
		exec: async () => ({ stdout: "", stderr: "", code: 0 }),
		ctx: { cwd: "/repo" } as RunContext["ctx"],
		cwd: "/repo",
		config: FALLBACK,
		runDir: "/run",
		artifactsDir: "/run/artifacts",
		state: { request, slug: "demo" } as RunContext["state"],
		feedback: { tick: () => {} },
		llm: { runRound: async () => ({ payload: undefined, errors: [], attempts: 0 }) },
		now: () => "t",
		readArtifact,
	};
}

const build = (rc: RunContext) => contextExtractPhase.buildPrompt!(rc);

describe("context-extract template", () => {
	it("is valid JSON that satisfies its own contract", () => {
		const obj = JSON.parse(CONTEXT_EXTRACT_TEMPLATE);
		expect(validateContract(ContextExtractContract, obj).ok).toBe(true);
	});
});

describe("contextExtractPhase.buildPrompt", () => {
	it("is wired as an llm phase against ContextExtractContract", () => {
		expect(contextExtractPhase.kind).toBe("llm");
		expect(contextExtractPhase.contract).toBe(ContextExtractContract);
	});

	it("embeds the requirement, cwd, and the collect-tree output", () => {
		const rc = mkRc("Add a payments flow", (id) =>
			id === "collect-tree" ? { treeText: ".\n└── src", _meta: {} } : null,
		);
		const p = build(rc);
		expect(p.system).toContain("ripgrep");
		expect(p.system).toContain("ast-grep");
		expect(p.system).toContain("READ-ONLY");
		expect(p.task).toContain("Add a payments flow");
		expect(p.task).toContain("/repo");
		expect(p.task).toContain("eza --tree");
		expect(p.task).toContain("└── src");
		expect(p.jsonTemplate).toBe(CONTEXT_EXTRACT_TEMPLATE);
	});

	it("notes a missing/empty tree as greenfield instead of embedding it", () => {
		const rc = mkRc("New project", () => null);
		const p = build(rc);
		expect(p.task).toContain("greenfield");
		expect(p.task).not.toContain("```");
	});

	it("treats a blank tree artifact the same as missing", () => {
		const rc = mkRc("x", (id) => (id === "collect-tree" ? { treeText: "   \n  " } : null));
		expect(build(rc).task).toContain("greenfield");
	});

	it("flags an empty requirement in the task", () => {
		const rc = mkRc("   ", () => null);
		expect(build(rc).task).toContain("empty requirement");
	});
});
