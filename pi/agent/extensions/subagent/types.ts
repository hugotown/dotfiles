// Spec-side types: what the caller supplies plus usage accounting.
// SDK-free so scheduling/validation can be unit-tested in isolation.

/** Reasoning effort for a subagent; maps directly to pi's --thinking levels. */
export type Variant = "low" | "medium" | "high";

/** One agent as supplied in the tool's `agents` array. */
export interface AgentSpec {
	name: string;
	/** The task (user message). What the agent must do. Required. */
	prompt: string;
	/** Behavior/persona (system prompt). Optional; omit for default behavior. */
	instructions?: string;
	provider: string;
	model: string;
	variant: Variant;
	context?: string;
	blockedTools?: string[];
	dependsOn?: string[];
}

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

export type AgentStatus = "pending" | "running" | "ok" | "failed" | "skipped";
