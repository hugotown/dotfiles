import { type AgentResult, emptyResult } from "../result.ts";
import type { AgentSpec } from "../types.ts";

export function spec(name: string, dependsOn?: string[]): AgentSpec {
	return { name, prompt: "do", provider: "p", model: "m", variant: "low", dependsOn };
}

export function ok(s: AgentSpec, output: string): AgentResult {
	return { ...emptyResult(s, "ok"), exitCode: 0, output };
}

export function skipped(s: AgentSpec, reason: string): AgentResult {
	return { ...emptyResult(s, "skipped"), skippedReason: reason };
}
