/** Contracts for collect-tree (det), context-extract (llm) and web-grounding (llm). */
import { Type } from "@sinclair/typebox";
import { arr, Base, Bool, loose, Num, opt, S } from "./base.ts";

export const CollectTreeContract = Type.Object({
	...Base,
	tool: S,
	depth: Num,
	treeText: S,
	lines: Num,
	truncated: Bool,
});

export const ContextExtractContract = loose({
	...Base,
	requirement: S,
	repoSummary: S,
	ripgrepSearches: opt(
		arr(loose({ query: S, rationale: opt(S), hitFiles: opt(arr(loose({ file: S, count: opt(Num) }))), notable: opt(arr(S)) })),
	),
	astGrepSearches: opt(
		arr(loose({ pattern: opt(S), rule: opt(S), lang: opt(S), rationale: opt(S), matches: opt(arr(loose({ file: S, line: opt(Num), snippet: opt(S) }))) })),
	),
	relevantFiles: opt(arr(loose({ path: S, role: opt(S), note: opt(S) }))),
	entrypoints: opt(arr(S)),
	conventions: opt(arr(S)),
	integrationPoints: opt(arr(loose({ file: S, note: opt(S) }))),
	risks: opt(arr(loose({ severity: S, text: S }))),
	openQuestions: opt(arr(S)),
	curatedContext: S,
});

/**
 * web-grounding (llm, runs before the interview): the child researches the web through
 * the DataImpulse proxy (ddg / Brave) to arrive at the brainstorm already expert — best
 * practices, conceptual validation, and technical + business risks. ALL web content is
 * untrusted (prompt-injection): the child only summarizes/cites and records any attempt
 * in `injectionFlags`. Best-effort: if the web is unreachable, `webAvailable=false` with
 * empty findings and `verdict="pass"` (it never blocks the run on a flaky network).
 */
export const WebGroundingContract = loose({
	...Base,
	topic: S,
	asOfDate: S, // injected by the harness (now()), not produced by the child
	webAvailable: Bool,
	queries: opt(arr(loose({ query: S, backend: opt(S), rationale: opt(S) }))),
	bestPractices: opt(arr(loose({ practice: S, why: opt(S), sources: opt(arr(S)) }))),
	conceptualValidations: opt(arr(loose({ claim: S, verdict: opt(S), evidence: opt(S), sources: opt(arr(S)) }))),
	risks: opt(arr(loose({ kind: S, severity: S, text: S, mitigation: opt(S), sources: opt(arr(S)) }))),
	recommendedApproaches: opt(arr(loose({ name: S, summary: opt(S), whenToUse: opt(S), sources: opt(arr(S)) }))),
	references: opt(arr(loose({ title: S, url: S, note: opt(S) }))),
	openConcerns: opt(arr(S)),
	injectionFlags: opt(arr(S)),
	curatedBriefing: S,
});
