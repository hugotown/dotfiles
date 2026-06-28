import { describe, expect, it } from "bun:test";
import { validateContract } from "../../src/contracts/base.ts";
import { CollectTreeContract } from "../../src/contracts/grounding.ts";
import { clipTree, collectTreePhase, MAX_TREE_LINES } from "../../src/phases/collect-tree.ts";
import { FALLBACK } from "../../src/config/defaults.ts";
import type { ObraConfig } from "../../src/types/config.ts";
import type { Exec, ExecResult } from "../../src/types/common.ts";
import type { RunContext } from "../../src/types/phase.ts";

function fakeExec(result: Partial<ExecResult>, calls?: string[][]): Exec {
	return async (cmd, args) => {
		calls?.push([cmd, ...args]);
		return { stdout: "", stderr: "", code: 0, ...result };
	};
}

function mkRc(exec: Exec, config: ObraConfig = FALLBACK): RunContext {
	return {
		exec,
		ctx: { cwd: "/repo" } as RunContext["ctx"],
		cwd: "/repo",
		config,
		runDir: "/run",
		artifactsDir: "/run/artifacts",
		state: { slug: "demo" } as RunContext["state"],
		feedback: { tick: () => {} },
		llm: { runRound: async () => ({ payload: undefined, errors: [], attempts: 0 }) },
		now: () => "t",
		readArtifact: () => null,
	};
}

const run = (exec: Exec, config?: ObraConfig): Promise<Record<string, unknown>> =>
	collectTreePhase.run!(mkRc(exec, config));

describe("clipTree", () => {
	it("returns empty for blank input", () => {
		expect(clipTree("   \n  ", 10)).toEqual({ treeText: "", truncated: false });
	});

	it("keeps content under the limit and strips trailing whitespace", () => {
		expect(clipTree("a\nb\nc\n", 10)).toEqual({ treeText: "a\nb\nc", truncated: false });
	});

	it("keeps content at exactly the limit", () => {
		const r = clipTree("a\nb\nc", 3);
		expect(r.truncated).toBe(false);
		expect(r.treeText).toBe("a\nb\nc");
	});

	it("truncates and appends a pluralized marker", () => {
		const r = clipTree("a\nb\nc\nd\ne", 2);
		expect(r.truncated).toBe(true);
		expect(r.treeText).toBe("a\nb\n… (3 more lines truncated)");
	});

	it("uses the singular marker for a single omitted line", () => {
		const r = clipTree("a\nb\nc", 2);
		expect(r.treeText).toBe("a\nb\n… (1 more line truncated)");
	});
});

describe("collectTreePhase.run", () => {
	it("runs eza with the configured depth and returns a valid artifact", async () => {
		const calls: string[][] = [];
		const out = await run(fakeExec({ code: 0, stdout: ".\n├── src\n└── test\n" }, calls));
		expect(calls[0]).toEqual(["eza", "--tree", "--level=5", "--git-ignore"]);
		expect(out).toMatchObject({ verdict: "pass", tool: "eza", depth: 5, lines: 3, truncated: false });
		expect(out.treeText).toBe(".\n├── src\n└── test");
		expect(validateContract(CollectTreeContract, out).ok).toBe(true);
	});

	it("honors a custom depth from config", async () => {
		const calls: string[][] = [];
		const config: ObraConfig = { ...FALLBACK, collectTree: { depth: 3 } };
		const out = await run(fakeExec({ code: 0, stdout: "." }, calls), config);
		expect(calls[0]).toEqual(["eza", "--tree", "--level=3", "--git-ignore"]);
		expect(out.depth).toBe(3);
	});

	it("blocks when eza exits nonzero", async () => {
		const out = await run(fakeExec({ code: 2, stderr: "boom" }));
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("exit 2");
		expect((out.blockers as string[])[0]).toContain("boom");
		expect(validateContract(CollectTreeContract, out).ok).toBe(true);
	});

	it("reports 'no stderr' when eza fails silently", async () => {
		const out = await run(fakeExec({ code: 1, stderr: "" }));
		expect((out.blockers as string[])[0]).toContain("no stderr");
	});

	it("marks the artifact truncated for an oversized tree", async () => {
		const big = Array.from({ length: MAX_TREE_LINES + 50 }, (_, i) => `f${i}`).join("\n");
		const out = await run(fakeExec({ code: 0, stdout: big }));
		expect(out.truncated).toBe(true);
		expect(out.lines).toBe(MAX_TREE_LINES + 1); // capped lines + the marker line
	});
});
