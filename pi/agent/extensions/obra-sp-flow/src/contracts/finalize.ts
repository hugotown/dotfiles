/** Contracts for approval-gate (gate), write-spec (det), spec-review (llm). */
import { Type } from "@sinclair/typebox";
import { arr, Base, Bool, loose, Num, opt, S } from "./base.ts";

export const ApprovalGateContract = Type.Object({
	...Base,
	decision: Type.Union([Type.Literal("approved"), Type.Literal("rejected"), Type.Literal("needs-revision")]),
	summaryShown: S,
	grantedAt: opt(S),
});

export const WriteSpecContract = Type.Object({
	...Base,
	specPath: S,
	specRelPath: S,
	projectSpecPath: S,
	committed: Bool,
	bytes: Num,
});

export const SpecReviewContract = loose({
	...Base,
	status: Type.Union([Type.Literal("Approved"), Type.Literal("Issues Found")]),
	issues: opt(arr(loose({ section: opt(S), issue: S, why: opt(S) }))),
	recommendations: opt(arr(S)),
	userDecision: opt(S),
});
