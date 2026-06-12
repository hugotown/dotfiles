// constants.ts — Static values shared across the extension.
export const CMD_NAME = "hugotown-method";
export const STATE_ENTRY = "hugotown-method-state";
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_BLOCKED_TOOLS = ["ask_user_question"];
export const COMPLETION_SIGNAL_DEFAULTS = ["ALL_TASKS_COMPLETE", "APPROVED", "DONE", "COMPLETE"];
export const BUILTIN_VAR_NAMES = [
  "ARGUMENTS", "ARTIFACTS_DIR", "BASE_BRANCH", "WORKFLOW_ID",
  "RUN_DIR", "DOCS_DIR", "REJECTION_REASON", "LOOP_PREV_OUTPUT", "LOOP_USER_INPUT",
];
export const QUESTION_PROHIBITION = [
  "## Constraint",
  "You are FORBIDDEN from asking the user any questions; the ask_user_question tool is disabled for you.",
  "When something is ambiguous, make the most reasonable assumption, state it explicitly, and proceed.",
  "Never stop to ask.",
].join("\n");
