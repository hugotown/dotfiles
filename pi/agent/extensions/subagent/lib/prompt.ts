// Builds the two halves handed to a subagent:
// - system prompt = the agent's behavior (`instructions`), see runner.ts;
// - user message  = its supporting material (dependency outputs + `context`)
//   followed by the actual task (`prompt`).
import { QUESTION_PROHIBITION } from "../constants.ts";
import type { AgentResult } from "../result.ts";
import type { AgentSpec } from "../types.ts";

/** Behavior-only system prompt plus the always-on prohibition against asking questions. */
export function buildSystemPrompt(spec: AgentSpec): string {
	const behavior = spec.instructions?.trim();
	return behavior ? `${behavior}\n\n${QUESTION_PROHIBITION}` : QUESTION_PROHIBITION;
}

/** User message: supporting material (deps + context) first, then the task itself. */
export function buildTask(spec: AgentSpec, deps: AgentResult[]): string {
	const blocks: string[] = [];
	for (const dep of deps) {
		blocks.push(`## Result from dependency "${dep.name}"\n\n${dep.output.trim() || "(no output)"}`);
	}
	const context = spec.context?.trim();
	if (context) blocks.push(`## Context\n\n${context}`);
	const task = spec.prompt.trim();
	if (blocks.length === 0) return task;
	return `${blocks.join("\n\n---\n\n")}\n\n---\n\n${task}`;
}
