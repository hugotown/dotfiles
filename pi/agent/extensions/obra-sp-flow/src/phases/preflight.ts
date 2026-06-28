/**
 * Phase 0 — Pre-flight (deterministic, no LLM).
 *
 * Adapted from the reference `using-git-worktrees` skill, stripped of all worktree
 * machinery (resolved decisions: no worktrees, no baseline commit). It keeps only the
 * skill's "detect first, then ask consent" ideas, recast as a deterministic git probe:
 *
 *  1. Verify the hard-dependency binaries exist (D5: bash/git/eza/rg/ast-grep). Missing -> block.
 *  2. No git repo -> ask to `git init` on `main` (no baseline commit); decline -> block.
 *  3. Dirty repo -> block immediately (no LLM, no later phase).
 *  4. Clean repo -> detect default + current branch, ask current-vs-new (+ base), suggest
 *     `feature/<slug>`. Never create a worktree.
 *
 * The decision is persisted to 00-preflight.json; Phase 3 applies it, Phase 6 keys off it.
 */
import { PreflightContract } from "../contracts/preflight.ts";
import type { Exec } from "../types/common.ts";
import type { Phase, RunContext } from "../types/phase.ts";

type Payload = Record<string, unknown>;

export interface ToolResult {
	name: string;
	present: boolean;
	version: string;
	binary?: string;
}

interface GitInfo {
	present: boolean;
	initializedByHarness: boolean;
	status: "clean" | "dirty" | "absent";
	defaultBranch: string;
	currentBranch: string;
}

interface Decision {
	mode: "direct-main" | "current-branch" | "new-branch" | "none";
	branchName?: string;
	branchBase?: string;
	userConfirmed: boolean;
}

export interface ToolProbe {
	name: string;
	bin: string;
	args: string[];
	alt?: string[]; // alternative binaries to try (e.g. ast-grep -> sg)
}

/** Hard dependencies (D5). All must exist or pre-flight blocks. */
export const REQUIRED_TOOLS: ToolProbe[] = [
	{ name: "bash", bin: "bash", args: ["--version"] },
	{ name: "git", bin: "git", args: ["--version"] },
	{ name: "eza", bin: "eza", args: ["--version"] },
	{ name: "rg", bin: "rg", args: ["--version"] },
	{ name: "ast-grep", bin: "ast-grep", args: ["--version"], alt: ["sg"] },
];

const COMMON_DEFAULTS = ["main", "master", "develop", "dev", "trunk"];

const firstLine = (s: string): string => s.split(/\r?\n/, 1)[0]?.trim() ?? "";

/** Try a tool (and its alternatives); record the first that exits 0. */
export async function probeTool(exec: Exec, probe: ToolProbe): Promise<ToolResult> {
	for (const bin of [probe.bin, ...(probe.alt ?? [])]) {
		const r = await exec(bin, probe.args);
		if (r.code === 0) {
			return { name: probe.name, present: true, version: firstLine(r.stdout) || firstLine(r.stderr), binary: bin };
		}
	}
	return { name: probe.name, present: false, version: "" };
}

export async function checkTools(exec: Exec): Promise<ToolResult[]> {
	const out: ToolResult[] = [];
	for (const p of REQUIRED_TOOLS) out.push(await probeTool(exec, p));
	return out;
}

export async function isGitRepo(exec: Exec): Promise<boolean> {
	const r = await exec("git", ["rev-parse", "--is-inside-work-tree"]);
	return r.code === 0 && r.stdout.trim() === "true";
}

export async function isDirty(exec: Exec): Promise<boolean> {
	const r = await exec("git", ["status", "--porcelain"]);
	return r.stdout.trim().length > 0;
}

export async function currentBranch(exec: Exec): Promise<string> {
	const r = await exec("git", ["branch", "--show-current"]);
	return r.stdout.trim();
}

/** Best-effort default branch: origin/HEAD, then common names, then the current branch. */
export async function detectDefaultBranch(exec: Exec, current: string): Promise<string> {
	const head = await exec("git", ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
	const ref = head.stdout.trim();
	if (head.code === 0 && ref) return ref.replace(/^refs\/remotes\/origin\//, "");
	for (const name of COMMON_DEFAULTS) {
		const v = await exec("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]);
		if (v.code === 0) return name;
	}
	return current;
}

const GIT_ABSENT: GitInfo = {
	present: false,
	initializedByHarness: false,
	status: "absent",
	defaultBranch: "",
	currentBranch: "",
};
const NO_DECISION: Decision = { mode: "none", userConfirmed: false };

function artifact(
	cwd: string,
	runDir: string,
	tools: ToolResult[],
	git: GitInfo,
	decision: Decision,
	blockers: string[],
): Payload {
	return {
		phase: "preflight",
		verdict: blockers.length ? "block" : "pass",
		blockers,
		cwd,
		runDir,
		tools,
		git,
		decision,
	};
}

async function runPreflight(rc: RunContext): Promise<Payload> {
	const { exec, ctx, cwd, runDir } = rc;
	rc.feedback.tick("pre-flight: checking required tools…");

	const tools = await checkTools(exec);
	const missing = tools.filter((t) => !t.present).map((t) => t.name);
	if (missing.length > 0) {
		return artifact(cwd, runDir, tools, GIT_ABSENT, NO_DECISION, [`missing required tools: ${missing.join(", ")}`]);
	}

	if (!(await isGitRepo(exec))) {
		const consent = await ctx.ui.confirm(
			"obra-sp-flow — pre-flight",
			"No git repository found here. Initialize one (git init on 'main', no baseline commit)?",
		);
		if (!consent) {
			return artifact(cwd, runDir, tools, GIT_ABSENT, NO_DECISION, [
				"no git repository and the user declined to initialize one",
			]);
		}
		const init = await exec("git", ["init"]);
		if (init.code !== 0) {
			return artifact(cwd, runDir, tools, GIT_ABSENT, NO_DECISION, [
				`git init failed: ${init.stderr.trim() || `exit ${init.code}`}`,
			]);
		}
		await exec("git", ["symbolic-ref", "HEAD", "refs/heads/main"]);
		const git: GitInfo = {
			present: true,
			initializedByHarness: true,
			status: "clean",
			defaultBranch: "main",
			currentBranch: "main",
		};
		return artifact(cwd, runDir, tools, git, { mode: "direct-main", branchBase: "main", userConfirmed: true }, []);
	}

	if (await isDirty(exec)) {
		const git: GitInfo = { present: true, initializedByHarness: false, status: "dirty", defaultBranch: "", currentBranch: "" };
		return artifact(cwd, runDir, tools, git, NO_DECISION, [
			"the working tree is dirty (staged/unstaged/untracked changes); commit or stash before running obra-sp-flow",
		]);
	}

	const current = await currentBranch(exec);
	const defaultBranch = await detectDefaultBranch(exec, current);
	const git: GitInfo = { present: true, initializedByHarness: false, status: "clean", defaultBranch, currentBranch: current };

	const onCurrent = `Work on the current branch (${current || "detached HEAD"})`;
	const createNew = "Create a new branch";
	const choice = await ctx.ui.select("obra-sp-flow — pre-flight", [onCurrent, createNew]);
	if (choice === undefined) {
		return artifact(cwd, runDir, tools, git, NO_DECISION, ["the user cancelled the branch decision"]);
	}
	if (choice === onCurrent) {
		return artifact(cwd, runDir, tools, git, { mode: "current-branch", branchBase: current, userConfirmed: true }, []);
	}

	const suggested = `feature/${rc.state.slug}`;
	const entered = await ctx.ui.input("New branch name", suggested);
	const branchName = (entered ?? "").trim() || suggested;

	const baseOptions = [...new Set([defaultBranch, current].filter(Boolean))];
	let branchBase = baseOptions[0] ?? "";
	if (baseOptions.length > 1) {
		const picked = await ctx.ui.select(`Create '${branchName}' from which base?`, baseOptions);
		if (picked === undefined) {
			return artifact(cwd, runDir, tools, git, NO_DECISION, ["the user cancelled the base-branch decision"]);
		}
		branchBase = picked;
	}

	return artifact(cwd, runDir, tools, git, { mode: "new-branch", branchName, branchBase, userConfirmed: true }, []);
}

export const preflightPhase: Phase = {
	id: "preflight",
	index: 0,
	title: "Pre-flight (deterministic git + tools check)",
	kind: "deterministic",
	contract: PreflightContract,
	run: runPreflight,
};
