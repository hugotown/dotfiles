// Folds `pi --mode json` stdout lines into a mutable AgentResult.
import type { AgentResult, SubMessage } from "../result.ts";

export function finalText(messages: SubMessage[]): string {
	// Prefer the last assistant text.
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) if (part.type === "text") return (part as { text: string }).text;
		}
	}
	// Fallback: an extension that short-circuited the turn may have emitted its own
	// text as a custom message (role "custom", string content) — e.g. hello → "world".
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		const content = (msg as { content?: unknown }).content;
		if (msg.role === "custom" && typeof content === "string") return content;
	}
	return "";
}

/**
 * customType of the extension that produced the output WITHOUT the model running.
 * Returns undefined when an assistant message has text (the model ran normally).
 */
export function interceptionSource(messages: SubMessage[]): string | undefined {
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) if (part.type === "text") return undefined;
		}
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		const content = (msg as { content?: unknown }).content;
		if (msg.role === "custom" && typeof content === "string") return msg.customType;
	}
	return undefined;
}

function accumulateUsage(result: AgentResult, msg: SubMessage): void {
	result.usage.turns++;
	const u = msg.usage;
	if (u) {
		result.usage.input += u.input ?? 0;
		result.usage.output += u.output ?? 0;
		result.usage.cacheRead += u.cacheRead ?? 0;
		result.usage.cacheWrite += u.cacheWrite ?? 0;
		result.usage.cost += u.cost?.total ?? 0;
		result.usage.contextTokens = u.totalTokens ?? result.usage.contextTokens;
	}
	if (msg.model) result.model = msg.model;
	if (msg.stopReason) result.stopReason = msg.stopReason;
	if (msg.errorMessage) result.errorMessage = msg.errorMessage;
}

/** Apply one JSON line; returns true when the result was mutated (so callers can emit). */
export function applyJsonLine(result: AgentResult, line: string): boolean {
	if (!line.trim()) return false;
	let event: { type?: string; message?: SubMessage };
	try {
		event = JSON.parse(line);
	} catch {
		return false;
	}
	const msg = event.message;
	if ((event.type !== "message_end" && event.type !== "tool_result_end") || !msg) return false;
	result.messages.push(msg);
	if (event.type === "message_end" && msg.role === "assistant") accumulateUsage(result, msg);
	result.output = finalText(result.messages) || result.output;
	result.interceptedBy = interceptionSource(result.messages);
	return true;
}
