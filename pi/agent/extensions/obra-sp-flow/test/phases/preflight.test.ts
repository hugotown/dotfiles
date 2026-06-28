import { describe, expect, it } from "bun:test";
import { validateContract } from "../../src/contracts/base.ts";
import { PreflightContract } from "../../src/contracts/preflight.ts";
import {
	checkTools,
	currentBranch,
	detectDefaultBranch,
	isDirty,
	isGitRepo,
	preflightPhase,
	probeTool,
} from "../../src/phases/preflight.ts";
import { FALLBACK } from "../../src/config/defaults.ts";
import type { Exec, ExecResult } from "../../src/types/common.ts";
import type { RunContext } from "../../src/types/phase.ts";
import type { CommandCtx, UiPort } from "../../src/types/ports.ts";

type Router = (cmd: string, args: string[]) => Partial<ExecResult>;

function fakeExec(router: Router): Exec {
	return async (cmd, args) => ({ stdout: "", stderr: "", code: 0, ...router(cmd, args) });
}

const key = (cmd: string, args: string[]): string => `${cmd} ${args.join(" ")}`;

/** Default router: every tool `--version` succeeds; git answers configurable below. */
function gitRouter(over: Record<string, Partial<ExecResult>> = {}): Router {
	return (cmd, args) => {
		const k = key(cmd, args);
		if (k in over) return over[k];
		if (args[0] === "--version") return { code: 0, stdout: `${cmd} 1.0.0` };
		return { code: 0, stdout: "" };
	};
}

function fakeUi(over: Partial<UiPort> = {}): UiPort {
	return {
		notify: () => {},
		setStatus: () => {},
		setWidget: () => {},
		confirm: async () => true,
		select: async () => undefined,
		input: async () => undefined,
		...over,
	};
}

function fakeCtx(ui: UiPort): CommandCtx {
	return {
		cwd: "/repo",
		hasUI: true,
		mode: "interactive",
		sessionManager: { getSessionFile: () => null },
		ui,
	};
}

function mkRc(exec: Exec, ui: UiPort, slug = "add-payments"): RunContext {
	return {
		exec,
		ctx: fakeCtx(ui),
		cwd: "/repo",
		config: FALLBACK,
		runDir: "/run",
		artifactsDir: "/run/artifacts",
		state: { slug } as RunContext["state"],
		feedback: { tick: () => {} },
		llm: { runRound: async () => ({ payload: undefined, errors: [], attempts: 0 }) },
		now: () => "t",
		readArtifact: () => null,
	};
}

const run = (exec: Exec, ui: UiPort, slug?: string): Promise<Record<string, unknown>> =>
	preflightPhase.run!(mkRc(exec, ui, slug));

describe("probeTool / checkTools", () => {
	it("records the first binary that exits 0", async () => {
		const r = await probeTool(fakeExec(gitRouter()), { name: "rg", bin: "rg", args: ["--version"] });
		expect(r).toEqual({ name: "rg", present: true, version: "rg 1.0.0", binary: "rg" });
	});

	it("falls back to the alternative binary (ast-grep -> sg)", async () => {
		const exec = fakeExec((cmd, args) => {
			if (cmd === "ast-grep") return { code: 127 };
			if (cmd === "sg") return { code: 0, stdout: "sg 0.9" };
			return { code: 0 };
		});
		const r = await probeTool(exec, { name: "ast-grep", bin: "ast-grep", args: ["--version"], alt: ["sg"] });
		expect(r).toEqual({ name: "ast-grep", present: true, version: "sg 0.9", binary: "sg" });
	});

	it("uses stderr for the version when stdout is empty", async () => {
		const exec = fakeExec(() => ({ code: 0, stdout: "", stderr: "eza v0.18\nextra" }));
		const r = await probeTool(exec, { name: "eza", bin: "eza", args: ["--version"] });
		expect(r.version).toBe("eza v0.18");
	});

	it("reports a missing tool", async () => {
		const exec = fakeExec(() => ({ code: 127 }));
		const r = await probeTool(exec, { name: "eza", bin: "eza", args: ["--version"] });
		expect(r).toEqual({ name: "eza", present: false, version: "" });
	});

	it("checkTools probes all required binaries", async () => {
		const tools = await checkTools(fakeExec(gitRouter()));
		expect(tools.map((t) => t.name)).toEqual(["bash", "git", "eza", "rg", "ast-grep"]);
		expect(tools.every((t) => t.present)).toBe(true);
	});
});

describe("git helpers", () => {
	it("isGitRepo true/false", async () => {
		expect(await isGitRepo(fakeExec(() => ({ code: 0, stdout: "true\n" })))).toBe(true);
		expect(await isGitRepo(fakeExec(() => ({ code: 128, stdout: "" })))).toBe(false);
	});

	it("isDirty reflects porcelain output", async () => {
		expect(await isDirty(fakeExec(() => ({ code: 0, stdout: " M src/x.ts\n" })))).toBe(true);
		expect(await isDirty(fakeExec(() => ({ code: 0, stdout: "" })))).toBe(false);
	});

	it("currentBranch trims the name", async () => {
		expect(await currentBranch(fakeExec(() => ({ code: 0, stdout: "feature/x\n" })))).toBe("feature/x");
	});

	it("detectDefaultBranch prefers origin/HEAD", async () => {
		const exec = fakeExec((cmd, args) =>
			key(cmd, args) === "git symbolic-ref --quiet refs/remotes/origin/HEAD"
				? { code: 0, stdout: "refs/remotes/origin/develop\n" }
				: { code: 1 },
		);
		expect(await detectDefaultBranch(exec, "x")).toBe("develop");
	});

	it("detectDefaultBranch probes common names when origin is absent", async () => {
		const exec = fakeExec((cmd, args) => {
			const k = key(cmd, args);
			if (k === "git symbolic-ref --quiet refs/remotes/origin/HEAD") return { code: 1 };
			if (k === "git rev-parse --verify --quiet refs/heads/master") return { code: 0, stdout: "abc" };
			return { code: 1 };
		});
		expect(await detectDefaultBranch(exec, "x")).toBe("master");
	});

	it("detectDefaultBranch falls back to the current branch", async () => {
		const exec = fakeExec(() => ({ code: 1 }));
		expect(await detectDefaultBranch(exec, "wip")).toBe("wip");
	});
});

describe("preflightPhase.run", () => {
	it("blocks when a required tool is missing", async () => {
		const exec = fakeExec((cmd) => (cmd === "eza" ? { code: 127 } : { code: 0, stdout: `${cmd} 1` }));
		const out = await run(exec, fakeUi());
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("eza");
		expect(validateContract(PreflightContract, out).ok).toBe(true);
	});

	it("no git + consent -> git init on main, direct-main decision", async () => {
		const calls: string[] = [];
		const exec: Exec = async (cmd, args) => {
			calls.push(key(cmd, args));
			if (args[0] === "--version") return { stdout: `${cmd} 1`, stderr: "", code: 0 };
			if (key(cmd, args) === "git rev-parse --is-inside-work-tree") return { stdout: "", stderr: "", code: 128 };
			return { stdout: "", stderr: "", code: 0 };
		};
		const out = await run(exec, fakeUi({ confirm: async () => true }));
		expect(out.verdict).toBe("pass");
		expect(out.git).toMatchObject({ present: true, initializedByHarness: true, status: "clean", defaultBranch: "main", currentBranch: "main" });
		expect(out.decision).toEqual({ mode: "direct-main", branchBase: "main", userConfirmed: true });
		expect(calls).toContain("git init");
		expect(calls).toContain("git symbolic-ref HEAD refs/heads/main");
		expect(validateContract(PreflightContract, out).ok).toBe(true);
	});

	it("no git + decline -> block", async () => {
		const exec = fakeExec(gitRouter({ "git rev-parse --is-inside-work-tree": { code: 128 } }));
		const out = await run(exec, fakeUi({ confirm: async () => false }));
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("declined");
		expect(out.decision).toMatchObject({ mode: "none", userConfirmed: false });
	});

	it("no git + init failure -> block", async () => {
		const exec = fakeExec(
			gitRouter({
				"git rev-parse --is-inside-work-tree": { code: 128 },
				"git init": { code: 1, stderr: "permission denied" },
			}),
		);
		const out = await run(exec, fakeUi({ confirm: async () => true }));
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("git init failed: permission denied");
	});

	it("dirty repo -> block immediately", async () => {
		const exec = fakeExec(
			gitRouter({
				"git rev-parse --is-inside-work-tree": { code: 0, stdout: "true" },
				"git status --porcelain": { code: 0, stdout: " M src/a.ts\n" },
			}),
		);
		const out = await run(exec, fakeUi());
		expect(out.verdict).toBe("block");
		expect(out.git).toMatchObject({ present: true, status: "dirty" });
		expect((out.blockers as string[])[0]).toContain("dirty");
	});

	function cleanRepo(over: Record<string, Partial<ExecResult>> = {}): Exec {
		return fakeExec(
			gitRouter({
				"git rev-parse --is-inside-work-tree": { code: 0, stdout: "true" },
				"git status --porcelain": { code: 0, stdout: "" },
				"git branch --show-current": { code: 0, stdout: "main\n" },
				"git symbolic-ref --quiet refs/remotes/origin/HEAD": { code: 1 },
				"git rev-parse --verify --quiet refs/heads/main": { code: 0, stdout: "abc" },
				...over,
			}),
		);
	}

	it("clean repo + choose current branch -> current-branch decision", async () => {
		const ui = fakeUi({ select: async (_t, opts) => opts[0] }); // "Work on the current branch (main)"
		const out = await run(cleanRepo(), ui);
		expect(out.verdict).toBe("pass");
		expect(out.decision).toEqual({ mode: "current-branch", branchBase: "main", userConfirmed: true });
	});

	it("clean repo + cancel branch choice -> block", async () => {
		const ui = fakeUi({ select: async () => undefined });
		const out = await run(cleanRepo(), ui);
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("cancelled the branch decision");
	});

	it("clean repo + new branch (single base, custom name) -> new-branch decision", async () => {
		// default == current == main, so only one base option -> no base prompt.
		const ui = fakeUi({ select: async (_t, opts) => opts[1], input: async () => "feature/custom" });
		const out = await run(cleanRepo(), ui);
		expect(out.decision).toEqual({ mode: "new-branch", branchName: "feature/custom", branchBase: "main", userConfirmed: true });
	});

	it("new branch with two bases prompts for the base; empty name falls back to the slug suggestion", async () => {
		const exec = cleanRepo({
			"git branch --show-current": { code: 0, stdout: "wip\n" }, // current != default(main) -> two bases
		});
		const seen: string[][] = [];
		const ui = fakeUi({
			select: async (_t, opts) => {
				seen.push(opts);
				return opts.length === 2 && opts[0].startsWith("Work") ? opts[1] : "main"; // new branch, then base=main
			},
			input: async () => "   ", // blank -> use suggestion feature/<slug>
		});
		const out = await run(exec, ui, "add-payments");
		expect(out.decision).toEqual({ mode: "new-branch", branchName: "feature/add-payments", branchBase: "main", userConfirmed: true });
		expect(seen.some((opts) => opts.includes("main") && opts.includes("wip"))).toBe(true);
	});

	it("new branch + cancel base choice -> block", async () => {
		const exec = cleanRepo({ "git branch --show-current": { code: 0, stdout: "wip\n" } });
		let n = 0;
		const ui = fakeUi({
			select: async (_t, opts) => (n++ === 0 ? opts[1] : undefined), // pick new branch, then cancel base
			input: async () => "feature/x",
		});
		const out = await run(exec, ui);
		expect(out.verdict).toBe("block");
		expect((out.blockers as string[])[0]).toContain("base-branch decision");
	});
});
