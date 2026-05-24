import type { PipelineState } from "../state.ts";

const PREAMBLE = (s: PipelineState) =>
	`You are one creative step in a deterministic dev pipeline for the activity: "${s.activity}".\n` +
	`Project context (compressed):\n${s.compressedContext}\n`;

/** FR-10/11: gather decisions via the ask_user_question tool (it renders the form + returns answers). */
export function brainstormPrompt(s: PipelineState): string {
	return (
		PREAMBLE(s) +
		(s.decisions ? `\nDecisions so far / prior answers:\n${s.decisions}\n` : "") +
		`\nGather the design decisions for this activity by calling the "ask_user_question" tool.\n` +
		`In that tool call:\n` +
		`- Put everything you can confidently infer from the context into "assumptions" (each with a confidence level) — do NOT ask those.\n` +
		`- Ask at most 5 of the HIGHEST-VALUE open questions. Give each a one-line "reasoning". Choose the best type per question:\n` +
		`  • "select" — one choice among mutually-exclusive options (each option: "label" + short "description"); mark the best-practice one as "default".\n` +
		`  • "multiselect" — when several options can apply at once.\n` +
		`  • "wireframe_select" — for DESIGN/UI/layout choices: like select, but give each option a small ASCII "wireframe" (string array; you may use {{accent}}…{{/accent}} tags) shown beside it so the user compares them visually.\n` +
		`  • "color_palette" — when the decision is a color; offer "presets" (each {name, hex}) and/or let the user type a custom hex.\n` +
		`  • "text" — open-ended; provide a recommended "default" answer.\n` +
		`- The user can also leave free-form comments, which come back to you — read them; they may correct your assumptions.\n` +
		`- You may call the tool MORE THAN ONCE within this turn (a follow-up round after seeing the answers); set done=true on the final call.\n` +
		`The tool shows the user an interactive form and returns their answers (+ comments).\n` +
		`When you are done gathering decisions, reply with a concise "## Decisions" summary listing each agreed decision — that summary is the handoff to the spec phase. Do NOT write any files.`
	);
}

/** FR-13/14: design spec, scaled to complexity, zero placeholders. */
export function specPrompt(s: PipelineState, specPath: string): string {
	return (
		PREAMBLE(s) +
		`\nAgreed decisions from brainstorming:\n${s.decisions}\n` +
		`\nWrite a complete design spec for this feature. Scale the sections to the complexity.\n` +
		`ZERO placeholders: no "TBD", no "TODO", no "fill in later". Every section must be concrete.\n` +
		(s.gateFeedback ? `\nRevision feedback to address (from the reviewer):\n${s.gateFeedback}\n` : "") +
		`Write it to "${specPath}" using the write tool. Write nothing else.`
	);
}

/** FR-15: self-review the spec, fixing inline only real issues. */
export function specReviewPrompt(specPath: string): string {
	return (
		`Re-read the design spec at "${specPath}".\n` +
		`Fix INLINE (using read + write) only real issues: contradictions, ambiguity, placeholders, gaps, scope creep.\n` +
		`Do not rewrite for style. When done, reply with exactly "clean" if nothing needed fixing, ` +
		`or a short bullet list of the fixes you made. The corrected file must remain at "${specPath}".`
	);
}

/** FR-17: the LLM decides WHAT to research and writes the lists; it executes nothing. */
export function researchDecisionPrompt(s: PipelineState, specPath: string, researchPath: string): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Decide what to research before writing the implementation plan. Do NOT run any tools to research now —\n` +
		`just LIST what should be looked up. Write to "${researchPath}" using the write tool, in this format:\n\n` +
		`PATTERNS:\n- <code pattern or symbol to grep for>\nFILES:\n- <path or glob of interest>\nLIBRARIES:\n- <library name to fetch docs for>\n\n` +
		`Write nothing else.`
	);
}

/** FR-19: bite-sized TDD tasks with exact paths + complete real code. No "→ commit" step (design §9). */
export function planAuthorPrompt(s: PipelineState, specPath: string, researchResults: string, planPath: string): string {
	return (
		`Read the approved design spec at "${specPath}".\n` +
		`Research results gathered deterministically for you:\n${researchResults}\n\n` +
		`Write a complete implementation plan as bite-sized TDD tasks. Each task: failing test → minimal code → run/pass.\n` +
		`DO NOT include any git commit steps (this pipeline never commits).\n` +
		`Every code step must contain REAL, complete code and EXACT file paths — no "TBD", no "similar to Task N".\n` +
		`Start each task heading with "### Task N:" and put a one-line task title after the colon (the extension reads these to build a checklist).\n` +
		(s.gateFeedback ? `\nRevision feedback to address (from the reviewer):\n${s.gateFeedback}\n` : "") +
		`Write it to "${planPath}" using the write tool. Write nothing else.`
	);
}

/** FR-20: self-review the plan for spec coverage, placeholders, type consistency. */
export function planReviewPrompt(specPath: string, planPath: string): string {
	return (
		`Re-read the design spec at "${specPath}" and the plan at "${planPath}".\n` +
		`Fix INLINE: ensure every spec requirement maps to a task; remove placeholders; make type/signature names consistent across tasks.\n` +
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
		`Do NOT commit anything. Do NOT touch other tasks.`
	);
}

/** FR-25: final review from the working-tree git diff (not prior reports). */
export function reviewPrompt(): string {
	return (
		`Run \`git diff\` (and \`git status\`) with bash to see the full uncommitted change set.\n` +
		`Review it for correctness. Output, in your reply:\n` +
		`A line "Verdict: APPROVED" or "Verdict: CHANGES REQUIRED", then findings grouped under ` +
		`"Critical:", "Important:", "Minor:" — each citing file:line. Base the review ONLY on the diff.`
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
		`Write it to "${notesPath}" using the write tool. Write nothing else.`
	);
}
