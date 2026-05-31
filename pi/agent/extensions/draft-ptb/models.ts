// Shared model specs and tool allowlists for subagent dispatchers.
// Centralises constants previously duplicated across impl/test/review dispatchers.

export const SONNET = { provider: "github-copilot", model: "claude-sonnet-4.6" };
export const OPUS = { provider: "github-copilot", model: "claude-opus-4.6" };

/** Tools available to subagents that WRITE code (implementation + test generation). */
export const WRITE_TOOLS = ["bash", "read", "write", "edit"];

/** Tools available to review subagents (read-only inspection). */
export const REVIEWER_TOOLS = ["read", "bash"];

/** Max retries when an implementer reports NEEDS_CONTEXT before escalating. */
export const MAX_IMPL_RETRIES = 2;
