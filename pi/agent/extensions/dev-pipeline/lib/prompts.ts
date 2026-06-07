import type { LibraryRef, PipelineState } from "../state.ts";

const PREAMBLE = (s: PipelineState) =>
	`You are one creative step in a deterministic dev pipeline for the activity: "${s.activity}".\n` +
	`Project context (compressed):\n${s.compressedContext}\n`;

/**
 * Every phase after the brainstorm is forbidden from interacting with the user: the brainstorm
 * already resolved every decision and the ask_user_question tool is not available here.
 */
const NO_USER_INPUT =
	`\nYou MUST NOT ask the user anything: all decisions were finalized in the brainstorm and the ask_user_question tool is unavailable in this phase. Work only from the provided artifacts and context. If something is still ambiguous, choose the best-practice option for this context and document the choice — never defer it to the user.\n`;

/** The exact line that signals the brainstorm is closed by DOUBLE confirmation (model + user). */
export const BRAINSTORM_DONE_MARKER = "BRAINSTORM_DONE";

/**
 * The exact ddg (DuckDuckGo CLI) invocation for web best-practice research. The default `auto`
 * backend is blocked through the proxy, so `--backend lite --user-agent chrome` is mandatory.
 * The $DI_* proxy credentials are loaded in the shell from SOPS via ~/.config/shell/env.zsh.
 */
export const DDG_RESEARCH_CMD =
	`ddg --query "<best-practice question>" --proxy "http://$DI_LOGIN:$DI_SEC@$DI_HOST:$DI_PORT" --user-agent "chrome" --backend lite --limit 10 --format`;

/**
 * FR-10/11: the brainstorm is the ONLY phase allowed to talk to the user. It probes the repo
 * itself, then resolves EVERY decision (architecture, functional + non-functional requirements,
 * business rules, UX/UI, color psychology) via the ask_user_question tool, with no fixed number
 * of questions, closing only when both the model and the user have no remaining doubts.
 */
export function brainstormPrompt(s: PipelineState): string {
	return (
		PREAMBLE(s) +
		`\nYou are the ONLY step in this pipeline allowed to talk to the user. Every later phase is FORBIDDEN from asking anything, so EVERY open question, ambiguity and decision MUST be resolved here. Aim for maximum determinism: leave nothing for a later phase to guess.\n\n` +
		`STEP 1 — Research BEFORE asking. Every question MUST carry a researched best-practice recommendation, so investigate two fronts:\n` +
		`(a) PROJECT STATE — probe the repo with the bash tool:\n` +
		`  - \`eza --tree --level=3 --ignore-glob 'node_modules|.git|dist|build'\` for the layout.\n` +
		`  - \`rg\` for existing patterns, conventions, configs and similar features.\n` +
		`  - \`ast-grep --help\` first, then \`ast-grep run --pattern …\` to locate existing functions, classes, types and structures you must integrate with.\n` +
		`  - If a \`graphify-out/\` directory exists, use it to understand the project's knowledge graph.\n` +
		`(b) BEST PRACTICES — search the web EXHAUSTIVELY with the ddg CLI (via bash). Run as many searches as needed to settle each area (architecture, requirements, UX/UI, color); keep searching until you have NO doubts — never stop at a single result. Use exactly:\n` +
		`  ${DDG_RESEARCH_CMD}\n` +
		`  Best-effort: if ddg fails or returns nothing, fall back to your own knowledge and SAY SO in the rationale.\n` +
		`Ground every assumption and every recommendation in what you actually found. Do NOT ask the user anything you can discover yourself.\n\n` +
		`STEP 2 — Drive the design decisions with the "ask_user_question" tool. Cover, as applicable to this activity:\n` +
		`- ARCHITECTURE: pattern/style, module boundaries, data flow, persistence, integration points.\n` +
		`- FUNCTIONAL REQUIREMENTS: every behavior the feature must exhibit (ask each explicitly).\n` +
		`- NON-FUNCTIONAL REQUIREMENTS: performance, security, accessibility, i18n, observability, limits.\n` +
		`- BUSINESS RULES: validations, permissions, edge cases, allowed/forbidden states and transitions.\n` +
		`- UX/UI: layout, flows, components, and empty/loading/error states.\n` +
		`- COLOR PSYCHOLOGY: palette and the emotional/brand intent behind it (use the color_palette type).\n\n` +
		`Rules for the questions:\n` +
		`- EVERY question MUST include a "default" (your researched best-practice recommendation) AND a "reasoning" (the rationale). The reasoning must cite WHAT you found: the best practice from your web research AND how it fits THIS project's current state. NEVER ask a question without a pre-filled recommendation and its rationale.\n` +
		`- Put everything you can confidently infer into "assumptions" (each with a confidence level) — do NOT ask those.\n` +
		`- Pick the best type per question: "select" (mutually-exclusive options, each "label" + short "description", best-practice one as "default"); "multiselect" (several apply at once); "wireframe_select" (layout/UI — give each option a small ASCII "wireframe" string array, you may use {{accent}}…{{/accent}} tags); "color_palette" (color decisions — offer "presets" as {name, hex}); "text" (open-ended, with a recommended "default").\n` +
		`- Read the user's free-form comments; they may correct your assumptions — adapt and re-ask.\n` +
		`- There is NO fixed number of questions or rounds. Call the tool as many times as needed (done=false until your final confirmation call).\n\n` +
		`STEP 3 — Close ONLY by double confirmation. When you believe nothing is left open, make a FINAL ask_user_question call (done=true) that presents the COMPLETE decision summary and asks the user to either confirm proceeding or request changes.\n` +
		`- If the user requests ANY change or raises new doubts, keep going (return to STEP 2). Do NOT close.\n` +
		`- ONLY when BOTH you have no remaining doubts AND the user has explicitly approved, end your turn with a "## Decisions" section listing every agreed decision (architecture, functional + non-functional requirements, business rules, UX/UI, colors), then a final line containing EXACTLY: ${BRAINSTORM_DONE_MARKER}\n` +
		`Do NOT write any files. Do NOT output ${BRAINSTORM_DONE_MARKER} until the user has explicitly approved.`
	);
}

/** Re-entry prompt when the model ended its turn without the double-OK close (safety net). */
export function brainstormContinuePrompt(): string {
	return (
		`You ended your turn WITHOUT closing the brainstorm: either you still have open questions, or the user has not explicitly approved yet.\n` +
		`Keep using "ask_user_question" to resolve every remaining doubt. Remember: later phases cannot ask the user ANYTHING, so everything must be settled now.\n` +
		`Close ONLY with a final confirmation question (done=true). When BOTH you have no doubts AND the user explicitly approves, end with a "## Decisions" summary, then a final line containing EXACTLY: ${BRAINSTORM_DONE_MARKER}`
	);
}

/** FR-13/14: design spec, scaled to complexity, zero placeholders. */
export function specPrompt(s: PipelineState, specPath: string): string {
	return (
		PREAMBLE(s) +
		`\nAgreed decisions from brainstorming (these are FINAL):\n${s.decisions}\n` +
		`\nWrite a complete design spec for this feature. Scale the sections to the complexity.\n` +
		`Formalize the agreed decisions into explicit sections: architecture, functional requirements, non-functional requirements, business rules, and UX/UI + colors.\n` +
		`ZERO placeholders: no "TBD", no "TODO", no "fill in later". Every section must be concrete.\n` +
		NO_USER_INPUT +
		`Write it to "${specPath}" using the write tool. Write nothing else.`
	);
}

/** FR-15: STRICT self-review — this replaces the former human approval gate, so it is the
 * last safety net before planning. Verify requirement coverage 1:1, not just style. */
export function specReviewPrompt(specPath: string): string {
	return (
		`Re-read the design spec at "${specPath}". This self-review is the ONLY gate before planning — be strict.\n` +
		`Build an explicit checklist: enumerate every functional requirement, non-functional requirement and business rule, and confirm each is concretely and unambiguously addressed in the spec.\n` +
		`Fix INLINE (using read + write) every real issue: contradictions, ambiguity, placeholders, missing requirements, gaps, scope creep. Do not rewrite for style.\n` +
		NO_USER_INPUT +
		`When done, reply with exactly "clean" if nothing needed fixing, or a short bullet list of the fixes you made. The corrected file must remain at "${specPath}".`
	);
}

/** FR-17: the LLM decides WHAT to research and writes the lists; it executes nothing. */
export function researchDecisionPrompt(s: PipelineState, specPath: string, researchPath: string): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Decide what to research before writing the implementation plan. Do NOT run any tools now — just LIST what should be looked up. The extension runs the base research deterministically, then deep-researches EACH library in its own clean context until it can implement it confidently.\n` +
		`Be EXHAUSTIVE. For LIBRARIES, give one per line as "name | topic", where topic is exactly what the plan must implement with it (the version is detected automatically from the manifest). For SEARCHES, list every best-practice web query needed (architecture, security, performance, accessibility). Write to "${researchPath}" using the write tool, in this format:\n\n` +
		`PATTERNS:\n- <code pattern or symbol to grep for>\nFILES:\n- <path or glob of interest>\nLIBRARIES:\n- <library name> | <what to implement with it>\nSEARCHES:\n- <best-practice web query to run on DuckDuckGo>\n\n` +
		NO_USER_INPUT +
		`Write nothing else.`
	);
}

/**
 * Deep-research ONE library in a clean context until the model can implement it confidently.
 * Uses ddg dorking to find version-correct examples on official docs / GitHub / changelogs.
 * Ends with a self-declared CONFIDENCE the orchestrator reads.
 */
export function libraryResearchPrompt(lib: LibraryRef, notesPath: string, priorNotes: string, attempt: number): string {
	return (
		`You are deep-researching ONE external library, in a clean context, so the plan can implement it with HIGH confidence.\n` +
		`Library: ${lib.name}\nVersion: ${lib.version}\nTopic (what the plan needs from it): ${lib.topic || "(general usage)"}\n\n` +
		(attempt > 0 && priorNotes.trim()
			? `Your previous attempt did NOT reach high confidence. Build on these notes and close the gaps:\n${priorNotes}\n\n`
			: "") +
		`Procedure:\n` +
		`1. Use the ddg CLI with DORKING to find real, version-correct implementation examples (official docs, GitHub code, changelogs). Command:\n` +
		`   ${DDG_RESEARCH_CMD}\n` +
		`   Useful dorks: \`${lib.name} ${lib.topic} site:github.com\`, \`${lib.name} ${lib.version} example\`, \`"${lib.name}" ${lib.topic} site:docs.rs OR site:pkg.go.dev\`.\n` +
		`2. You may also run \`ast-grep --help\` then \`ast-grep\` over any locally vendored copy.\n\n` +
		`Keep researching (as many searches as needed) until you genuinely know HOW to implement ${lib.name} for "${lib.topic}". Write concrete, version-correct code examples and the key API surface to "${notesPath}" using the write tool.\n` +
		NO_USER_INPUT +
		`End your reply with a final line containing EXACTLY one of: "CONFIDENCE: high", "CONFIDENCE: medium", "CONFIDENCE: low" — your honest confidence that you can now implement this library correctly. Declare "high" ONLY when the notes hold concrete, version-appropriate examples.`
	);
}

/** FR-19: bite-sized TDD tasks with exact paths + complete real code. No "→ commit" step (design §9). */
export function planAuthorPrompt(
	s: PipelineState,
	specPath: string,
	researchResults: string,
	libraryNotes: string,
	planPath: string,
): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Base research gathered deterministically for you:\n${researchResults}\n\n` +
		`Per-library implementation research (version-correct examples — follow these for any library usage):\n${libraryNotes}\n\n` +
		`Write a complete implementation plan as bite-sized TDD tasks. Each task: failing test → minimal code → run/pass.\n` +
		`DO NOT include any git commit steps (this pipeline never commits).\n` +
		`Every code step must contain REAL, complete code and EXACT file paths — no "TBD", no "similar to Task N".\n` +
		`Start each task heading with "### Task N:" and put a one-line task title after the colon (the extension reads these to build a checklist).\n` +
		NO_USER_INPUT +
		`Write it to "${planPath}" using the write tool. Write nothing else.`
	);
}

/** FR-20: STRICT self-review — replaces the former human approval gate, last gate before
 * implementation. Verify every spec requirement maps to a task. */
export function planReviewPrompt(specPath: string, planPath: string): string {
	return (
		`Re-read the design spec at "${specPath}" and the plan at "${planPath}". This self-review is the ONLY gate before implementation — be strict.\n` +
		`Build an explicit checklist: list every spec requirement (functional, non-functional, business rule) and confirm a task covers it. If any is missing, ADD the task inline.\n` +
		`Fix INLINE: remove placeholders; make type/signature names consistent across tasks; ensure every task has real, complete code and exact paths.\n` +
		NO_USER_INPUT +
		`Reply "clean" or a short bullet list of fixes. The corrected plan stays at "${planPath}".`
	);
}

/** FR-22/24: implement ONE task with TDD. */
export function implementTaskPrompt(s: PipelineState, planPath: string, taskTitle: string, taskNumber: number): string {
	return (
		`Read the plan at "${planPath}". Implement ONLY Task ${taskNumber}: "${taskTitle}".\n` +
		`Follow TDD: write the failing test first, then the minimal code to pass it. Use read/write/edit/bash.\n` +
		`Run the tests yourself with bash to confirm they pass.\n` +
		`If after honest effort the task cannot pass, DO NOT weaken or delete the test. Instead reply starting with "BLOCKED:" and explain why.\n` +
		NO_USER_INPUT +
		`Do NOT commit anything. Do NOT touch other tasks.`
	);
}

/** FR-25: final review from the working-tree git diff (not prior reports). */
export function reviewPrompt(): string {
	return (
		`Run \`git diff\` (and \`git status\`) with bash to see the full uncommitted change set.\n` +
		`Review it for correctness. Output, in your reply:\n` +
		`A line "Verdict: APPROVED" or "Verdict: CHANGES REQUIRED", then findings grouped under ` +
		`"Critical:", "Important:", "Minor:" — each citing file:line. Base the review ONLY on the diff.` +
		NO_USER_INPUT
	);
}

/** FR-26: implementation notes artifact. */
export function notesPrompt(s: PipelineState, notesPath: string, verdict: string): string {
	const taskLines = s.tasks.map((t) => `- Task ${t.id} (${t.status}): ${t.title}`).join("\n");
	return (
		`Write implementation notes for "${s.activity}".\n` +
		`Code review verdict was: ${verdict}.\n` +
		`Tasks:\n${taskLines}\n\n` +
		`Include: what shipped per task, files changed (use \`git diff --stat\` via bash), deviations from the plan, test status,\n` +
		`and the verdict. If the verdict was CHANGES REQUIRED, list the outstanding issues.\n` +
		NO_USER_INPUT +
		`Write it to "${notesPath}" using the write tool. Write nothing else.`
	);
}
