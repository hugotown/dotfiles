/** Contract for the deterministic pre-flight phase (00-preflight.json). */
import { Type } from "@sinclair/typebox";
import { arr, Base, Bool, loose, opt, S } from "./base.ts";

/** One required-binary availability record (D5: hard dependencies, no fallback). */
export const ToolInfo = loose({
	name: S,
	present: Bool,
	version: S,
	binary: opt(S), // the actual binary used (e.g. ast-grep vs sg)
});

export const GitInfo = loose({
	present: Bool,
	initializedByHarness: Bool,
	status: Type.Union([Type.Literal("clean"), Type.Literal("dirty"), Type.Literal("absent")]),
	defaultBranch: S,
	currentBranch: S,
});

/** Branch decision persisted for later phases (workspace applies it; close keys off mode). */
export const PreflightDecision = loose({
	mode: Type.Union([
		Type.Literal("direct-main"),
		Type.Literal("current-branch"),
		Type.Literal("new-branch"),
		Type.Literal("none"),
	]),
	branchName: opt(S),
	branchBase: opt(S),
	userConfirmed: Bool,
});

export const PreflightContract = loose({
	...Base,
	phase: S,
	cwd: S,
	runDir: S,
	tools: arr(ToolInfo),
	git: GitInfo,
	decision: PreflightDecision,
});
