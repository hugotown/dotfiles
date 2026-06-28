/**
 * Phase 1 · step 2 — context-extract (LLM, embedded prompt).
 *
 * First ambiguous task of the flow: deciding WHICH parts of the repo matter for the
 * requirement needs judgment, so it runs as an isolated, clean-context pi child. The
 * control flow stays deterministic: the executor re-validates the child's JSON against
 * `ContextExtractContract` and retries with a correction on a bad reply.
 *
 * Grounding inputs: the requirement (`state.request`) + the `collect-tree` artifact.
 * The child has read-only tools (`read,grep,find,ls,bash`) and the ast-grep skill, so it
 * runs its own `rg`/`ast-grep` searches against the real checkout and returns curated,
 * structured context for the brainstorm step. No external skill is loaded into the harness;
 * this prompt is the skill, rewritten inline (principle #5).
 */
import { ContextExtractContract } from "../contracts/grounding.ts";
import type { LlmPrompt, Phase, RunContext } from "../types/phase.ts";

const SYSTEM = [
	"You are a senior engineer doing repository reconnaissance to ground a feature design.",
	"Your single deliverable is curated, structured context — you DESIGN nothing and CHANGE nothing.",
	"",
	"Hard rules:",
	"- READ-ONLY. Never write, edit, or run mutating commands. Investigation only.",
	"- Cite real paths that exist in the checkout. Never invent files, symbols, or APIs.",
	"- Prefer evidence over assumption: when you claim something, you ran a search that shows it.",
	"",
	"Tools you have:",
	"- `rg` (ripgrep) for fast text/string search.",
	"- `ast-grep` for structural, language-aware code search (its skill is loaded).",
	"- `read`/`ls`/`find` to inspect files and the layout.",
	"Use ripgrep for strings/identifiers and ast-grep for code shapes (call sites, signatures, patterns).",
	"",
	"Process:",
	"1. Restate the requirement so the design step inherits a crisp objective.",
	"2. Use the provided repo tree as a map, then run targeted `rg`/`ast-grep` searches to locate the code the feature will touch.",
	"3. Identify relevant files (path + role), entrypoints, project conventions, integration points, risks, and open questions for the brainstorm.",
	"4. Record the actual searches you ran (queries/patterns + notable hits) so the grounding is auditable.",
	"",
	"If the checkout is empty or greenfield, say so in `repoSummary`, keep the arrays minimal, and still return a valid object.",
	"Set `verdict` to \"pass\" normally; use \"block\" with `blockers` only if you genuinely cannot investigate.",
	"`curatedContext` must be a concise Markdown briefing the design step can read top-to-bottom without re-deriving anything.",
].join("\n");

/** Representative skeleton (kept a valid ContextExtractContract example; see tests). */
const TEMPLATE_OBJECT = {
	verdict: "pass",
	blockers: [],
	requirement: "<restate the requirement in one or two sentences>",
	repoSummary: "<what this repo is: stack, layout, purpose>",
	ripgrepSearches: [
		{
			query: "<rg query you ran>",
			rationale: "<why this search>",
			hitFiles: [{ file: "path/to/file", count: 0 }],
			notable: ["<notable finding>"],
		},
	],
	astGrepSearches: [
		{
			pattern: "<ast-grep pattern>",
			lang: "<language>",
			rationale: "<why this search>",
			matches: [{ file: "path/to/file", line: 0, snippet: "<matched code>" }],
		},
	],
	relevantFiles: [{ path: "path/to/file", role: "<role in this feature>", note: "<note>" }],
	entrypoints: ["<entrypoint file or symbol>"],
	conventions: ["<project convention to respect>"],
	integrationPoints: [{ file: "path/to/file", note: "<where the feature plugs in>" }],
	risks: [{ severity: "low|medium|high", text: "<risk>" }],
	openQuestions: ["<question to resolve in the brainstorm>"],
	curatedContext: "# Context briefing\n<concise Markdown the design step can read directly>",
};

export const CONTEXT_EXTRACT_TEMPLATE = JSON.stringify(TEMPLATE_OBJECT, null, 2);

function readTree(rc: RunContext): { text: string; available: boolean } {
	const art = rc.readArtifact("collect-tree") as { treeText?: string } | null;
	const text = (art?.treeText ?? "").trim();
	return { text, available: text.length > 0 };
}

function buildPrompt(rc: RunContext): LlmPrompt {
	const requirement = rc.state.request.trim();
	const tree = readTree(rc);
	const treeBlock = tree.available
		? `## Repository tree (eza --tree)\n\`\`\`\n${tree.text}\n\`\`\``
		: "## Repository tree\n(unavailable or empty — treat the checkout as greenfield/sparse and rely on direct searches.)";

	const task = [
		"## Requirement",
		requirement || "(empty requirement — flag this as a blocker)",
		"",
		`## Working directory\n${rc.cwd}`,
		"",
		treeBlock,
		"",
		"## Your job",
		"Investigate this repository for the requirement above and produce curated grounding context.",
		"Run real `rg`/`ast-grep` searches; do not guess. Then fill the JSON object below.",
	].join("\n");

	return { system: SYSTEM, task, jsonTemplate: CONTEXT_EXTRACT_TEMPLATE };
}

export const contextExtractPhase: Phase = {
	id: "context-extract",
	index: 2,
	title: "Context extract (rg + ast-grep reconnaissance)",
	kind: "llm",
	contract: ContextExtractContract,
	buildPrompt,
};
