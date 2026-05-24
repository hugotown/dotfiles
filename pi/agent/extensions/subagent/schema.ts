// TypeBox parameter schema for the `subagent` tool. The descriptions are read by the
// calling model, so they encode the contract (required vs optional, token discipline).
import { Type } from "typebox";

const VariantSchema = Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")], {
	description:
		"Reasoning effort for this agent (maps to pi's --thinking). REQUIRED: you must decide it per agent — 'low' for simple/mechanical work, 'medium' for normal tasks, 'high' for hard reasoning.",
});

const AgentSpecSchema = Type.Object({
	name: Type.String({
		description: "Unique identifier for this agent. Other agents reference it in their dependsOn.",
	}),
	prompt: Type.String({
		description:
			"REQUIRED. The agent's user message — the TASK: the concrete instructions of what the agent must do (e.g. 'Summarize file X and list its exported functions'). This is the request the agent acts on, step by step if needed. Put ONLY the task here; behavior, persona and tone go in `instructions`, not here.",
	}),
	instructions: Type.Optional(
		Type.String({
			description:
				"OPTIONAL. The agent's system prompt — its BEHAVIOR, not its task: who the agent is, how it must reason, its tone, and any strict/rigid rules it must always obey (e.g. 'answer only in JSON', 'be terse', 'never speculate'). Do NOT put the task here — that goes in `prompt`. Omit entirely when the default behavior is fine.",
		}),
	),
	provider: Type.String({
		description: "Model provider, e.g. 'github-copilot', 'anthropic', 'openai', 'google'. Required.",
	}),
	model: Type.String({
		description: "Model id within the provider, e.g. 'claude-sonnet-4.6'. Required.",
	}),
	variant: VariantSchema,
	context: Type.Optional(
		Type.String({
			description:
				"OPTIONAL supporting material for the task (reference text, data, prior results). It is delivered TOGETHER WITH `prompt` in the user message — NOT in the system prompt — because it is per-task data, not agent behavior. FORBIDDEN to pass context that does not add value; prefer omitting it to save tokens. Outputs of agents listed in `dependsOn` are injected here automatically.",
		}),
	),
	blockedTools: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Tool names to DENY this agent (blocklist). By default it has every tool a main agent has, MINUS these. 'ask_user_question' is always blocked regardless of this list.",
		}),
	),
	dependsOn: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Names of agents this one waits for. It starts only after ALL listed agents have finished successfully, and receives each of their outputs as context. If ANY of them fails or is skipped, this agent is skipped too. Omit or leave empty for no dependencies — independent agents run immediately and in parallel.",
		}),
	),
});

export const SubagentParams = Type.Object({
	agents: Type.Array(AgentSpecSchema, {
		minItems: 1,
		description:
			"Agents to run. Agents without dependsOn run in parallel; dependsOn defines a dependency graph (DAG) that orders execution and feeds each agent's output to its dependents.",
	}),
});
