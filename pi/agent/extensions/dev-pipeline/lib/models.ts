import type { Phase } from "../state.ts";

/** NFR-9: model IDs in configurable constants. Provider + IDs confirmed in enabledModels. */
export const SONNET = { provider: "github-copilot", id: "claude-sonnet-4.6" } as const;
export const OPUS = { provider: "github-copilot", id: "claude-opus-4.6" } as const;

export type ModelRef = { provider: string; id: string };

/** Read-only built-in tool sets, scoped per phase (FR-29). */
const READ_ONLY = ["read", "grep", "find", "ls"];
const READ_ONLY_BASH = ["read", "grep", "find", "ls", "bash"];
const WRITE_DOCS = ["read", "grep", "find", "ls", "write"];
const IMPLEMENT = ["read", "write", "edit", "bash"];

/** FR-27 + FR-29: the model and active tools for each LLM-driven phase. */
export const PHASE_CONFIG: Partial<Record<Phase, { model: ModelRef; tools: string[] }>> = {
	BRAINSTORM: { model: SONNET, tools: [...READ_ONLY, "ask_user_question"] },
	SPEC: { model: OPUS, tools: WRITE_DOCS },
	SPEC_SELF_REVIEW: { model: OPUS, tools: WRITE_DOCS },
	PLAN_RESEARCH: { model: SONNET, tools: READ_ONLY_BASH },
	PLAN_AUTHOR: { model: OPUS, tools: WRITE_DOCS },
	PLAN_SELF_REVIEW: { model: OPUS, tools: WRITE_DOCS },
	IMPLEMENT: { model: SONNET, tools: IMPLEMENT },
	REVIEW: { model: OPUS, tools: READ_ONLY },
	NOTES: { model: SONNET, tools: WRITE_DOCS },
};
