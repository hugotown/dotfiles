// Folds `pi --mode json` stdout lines into a mutable AgentResult. We consume both
// terminal events (message_end, tool_execution_end) for the final shape AND streaming
// events (message_update with text/thinking/toolcall deltas, tool_execution_update)
// so the panel can show progress while a turn is in flight.
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

function extractDeltaString(evt: { type?: string; delta?: unknown; content?: unknown }): string | undefined {
	if (evt.type === "text_delta" || evt.type === "thinking_delta" || evt.type === "toolcall_delta") {
		return typeof evt.delta === "string" ? evt.delta : undefined;
	}
	if (evt.type === "text_end" || evt.type === "thinking_end") {
		return typeof evt.content === "string" ? evt.content : undefined;
	}
	return undefined;
}

/** Read tool output as a string from the various shapes providers send. */
function extractToolOutput(partialResult: unknown): string | undefined {
	if (typeof partialResult === "string") return partialResult;
	if (partialResult && typeof partialResult === "object") {
		const r = partialResult as { output?: unknown; content?: unknown; stdout?: unknown };
		if (typeof r.output === "string") return r.output;
		if (typeof r.content === "string") return r.content;
		if (typeof r.stdout === "string") return r.stdout;
	}
	return undefined;
}

/** Apply one JSON line; returns true when the result was mutated (so callers can emit). */
export function applyJsonLine(result: AgentResult, line: string): boolean {
	if (!line.trim()) return false;
	let event: { type?: string; message?: SubMessage; assistantMessageEvent?: { type?: string; delta?: unknown; content?: unknown }; toolCallId?: string; partialResult?: unknown; result?: unknown; isError?: boolean };
	try {
		event = JSON.parse(line);
	} catch {
		return false;
	}

	// Streaming deltas: text/thinking/toolcall arrive as message_update → assistantMessageEvent.
	if (event.type === "message_update" && event.assistantMessageEvent) {
		const delta = extractDeltaString(event.assistantMessageEvent as { type?: string; delta?: unknown; content?: unknown });
		if (delta) {
			result.output += delta;
			return true;
		}
		return false;
	}

	// Tool execution streaming: tool_execution_update carries partialResult; tool_execution_end
	// carries the final result. We mirror the same key in toolOutputs so the panel sees progress.
	if (event.type === "tool_execution_update" || event.type === "tool_execution_start" || event.type === "tool_execution_end") {
		const id = event.toolCallId;
		if (!id) return false;
		if (event.type === "tool_execution_update") {
			const out = extractToolOutput(event.partialResult);
			if (out === undefined) return false;
			result.toolOutputs.set(id, out);
			return true;
		}
		if (event.type === "tool_execution_start") {
			// Reserve the slot so the panel can render a header line; don't emit if already present.
			if (result.toolOutputs.has(id)) return false;
			result.toolOutputs.set(id, "");
			return true;
		}
		// tool_execution_end: replace streaming partial with the final result (as string when possible).
		const finalOut = extractToolOutput(event.result);
		result.toolOutputs.set(id, finalOut ?? (event.result == null ? "" : String(event.result)));
		return true;
	}

	const msg = event.message;
	if (msg && (event.type === "message_end" || event.type === "tool_result_end")) {
		result.messages.push(msg);
		if (event.type === "message_end" && msg.role === "assistant") accumulateUsage(result, msg);
		result.output = finalText(result.messages) || result.output;
		result.interceptedBy = interceptionSource(result.messages);
		return true;
	}
	return false;
}
