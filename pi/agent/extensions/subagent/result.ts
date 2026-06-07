// Runtime result types: the streamed subprocess messages and per-agent run state.
import { type AgentSpec, type AgentStatus, emptyUsage, type UsageStats, type Variant } from "./types.ts";

/** Minimal shape of the messages emitted by `pi --mode json` that we consume. */
export interface SubMessage {
	role: string;
	content: Array<
		| { type: "text"; text: string }
		| { type: "toolCall"; name: string; arguments: Record<string, unknown> }
		| { type: string; [key: string]: unknown }
	>;
	usage?: {
		input?: number;
		output?: number;
		cacheRead?: number;
		cacheWrite?: number;
		cost?: { total?: number };
		totalTokens?: number;
	};
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	/** Present on custom messages emitted by an extension (role "custom"). */
	customType?: string;
}

/** Live and final state of a single agent run. */
export interface AgentResult {
	name: string;
	status: AgentStatus;
	provider: string;
	model: string;
	variant: Variant;
	/** Composed user message (dependency outputs + context). */
	task: string;
	exitCode: number;
	messages: SubMessage[];
	/** Latest assistant text; final output once status is terminal. */
	output: string;
	stderr: string;
	stopReason?: string;
	errorMessage?: string;
	skippedReason?: string;
	/** customType of the extension that short-circuited the turn (output is its effect, not the model's). */
	interceptedBy?: string;
	/** Registered flag tokens found in this agent's prompt/context (heads-up, may be intercepted). */
	flagsInPrompt?: string[];
	/** Live streaming output of each running tool, keyed by toolCallId. Mutated as deltas arrive. */
	toolOutputs: Map<string, string>;
	usage: UsageStats;
}

export interface SubagentDetails {
	results: AgentResult[];
}

/** A fresh result for `spec` in the given status, carrying its provider/model/variant. */
export function emptyResult(spec: AgentSpec, status: AgentStatus, task = ""): AgentResult {
	return {
		name: spec.name,
		status,
		provider: spec.provider,
		model: spec.model,
		variant: spec.variant,
		task,
		exitCode: status === "running" ? 0 : -1,
		messages: [],
		output: "",
		stderr: "",
		toolOutputs: new Map(),
		usage: emptyUsage(),
	};
}

/** A not-yet-started result, used for the input-ordered live view. */
export function pendingResult(spec: AgentSpec): AgentResult {
	return emptyResult(spec, "pending");
}
