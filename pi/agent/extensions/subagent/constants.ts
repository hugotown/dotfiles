// Static prompt text for the subagent tool: policy injected into each CHILD agent, and
// guidance surfaced to the PARENT model that decides how to delegate.

/** Tools blocked for every subagent, regardless of the per-agent blockedTools list. */
export const DEFAULT_BLOCKED_TOOLS = ["ask_user_question"];

/** Appended to each agent's instructions; pairs with blocking ask_user_question. */
export const QUESTION_PROHIBITION = [
	"## Constraint",
	"You are FORBIDDEN from asking the user any questions; the ask_user_question tool is disabled for you.",
	"When something is ambiguous, make the most reasonable assumption, state it explicitly in your output, and proceed.",
	"Never stop to ask.",
].join("\n");

/** One-liner shown in the parent's "Available tools" system-prompt section. */
export const SUBAGENT_SNIPPET =
	"delegate tasks to isolated agents that run in parallel or as a dependency graph, each with its own provider/model and reasoning level";

/** Pre-requisites the parent must reason through BEFORE calling subagent. */
export const SUBAGENT_GUIDELINES = [
	"Put the TASK (what the agent must do) in `prompt` — it is the user message. Use `instructions` only for behavior/persona/tone/rigid rules, and omit it when the default behavior is fine. Never put the task in `instructions`.",
	"Before delegating, size each agent: set `variant` from the reasoning demand ('low' = mechanical/lookup, 'medium' = normal, 'high' = genuinely hard reasoning).",
	"Pick the lightest model that fits: default to a Sonnet-class model and reserve an Opus-class model for deep-reasoning tasks. If the user already named a model, use exactly that and do not substitute it.",
	"Set `dependsOn` only for real data dependencies so independent agents run in parallel; pass `context` only when it adds value, to save tokens.",
];
