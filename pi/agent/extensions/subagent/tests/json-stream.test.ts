import { describe, expect, test } from "bun:test";
import { applyJsonLine } from "../lib/json-stream.ts";
import { emptyResult } from "../result.ts";
import { spec } from "./fixtures.ts";

function textDeltaLine(delta: string, contentIndex = 0): string {
	return JSON.stringify({
		type: "message_update",
		message: { role: "assistant", content: [] },
		assistantMessageEvent: { type: "text_delta", contentIndex, delta, partial: { role: "assistant", content: [] } },
	});
}

function messageStartLine(): string {
	return JSON.stringify({ type: "message_start", message: { role: "assistant", content: [] } });
}

function messageEndLine(usage?: object): string {
	return JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "" }], ...(usage ? { usage } : {}) } });
}

function toolExecutionUpdateLine(toolCallId: string, partialResult: string): string {
	return JSON.stringify({ type: "tool_execution_update", toolCallId, toolName: "bash", args: {}, partialResult });
}

function toolExecutionStartLine(toolCallId: string): string {
	return JSON.stringify({ type: "tool_execution_start", toolCallId, toolName: "bash", args: { cmd: "ls" } });
}

function toolExecutionEndLine(toolCallId: string, result: string, isError = false): string {
	return JSON.stringify({ type: "tool_execution_end", toolCallId, toolName: "bash", result, isError });
}

describe("applyJsonLine — text streaming via message_update", () => {
	test("accumulates text_delta into result.output and marks mutated", () => {
		const result = emptyResult(spec("a"), "running");
		expect(applyJsonLine(result, textDeltaLine("Hello"))).toBe(true);
		expect(applyJsonLine(result, textDeltaLine(", world"))).toBe(true);
		expect(result.output).toBe("Hello, world");
	});

	test("emits after each delta so the panel re-renders", () => {
		const result = emptyResult(spec("a"), "running");
		expect(applyJsonLine(result, textDeltaLine("A"))).toBe(true);
		expect(applyJsonLine(result, textDeltaLine("B"))).toBe(true);
		expect(applyJsonLine(result, textDeltaLine("C"))).toBe(true);
		expect(result.output).toBe("ABC");
	});

	test("ignores message_update without an assistantMessageEvent payload", () => {
		const result = emptyResult(spec("a"), "running");
		const bad = JSON.stringify({ type: "message_update", message: { role: "assistant", content: [] } });
		expect(applyJsonLine(result, bad)).toBe(false);
		expect(result.output).toBe("");
	});

	test("ignores assistantMessageEvent variants other than text_delta/thinking_delta", () => {
		const result = emptyResult(spec("a"), "running");
		const start = JSON.stringify({
			type: "message_update",
			message: { role: "assistant", content: [] },
			assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: { role: "assistant", content: [] } },
		});
		expect(applyJsonLine(result, start)).toBe(false);
	});

	test("emits on tool_execution_update with partialResult so the panel shows progress", () => {
		const result = emptyResult(spec("a"), "running");
		expect(applyJsonLine(result, toolExecutionUpdateLine("tc1", "line 1\n"))).toBe(true);
		expect(applyJsonLine(result, toolExecutionUpdateLine("tc1", "line 2\n"))).toBe(true);
		// partialResult carries the full current output for this tool, not a delta;
		// the latest value is what the panel shows.
		expect(result.toolOutputs.get("tc1")).toBe("line 2\n");
	});

	test("emits on tool_execution_start so a header line is visible", () => {
		const result = emptyResult(spec("a"), "running");
		expect(applyJsonLine(result, toolExecutionStartLine("tc1"))).toBe(true);
		expect(result.toolOutputs.has("tc1")).toBe(true);
	});

	test("tool_execution_end replaces the streaming partial with the final result", () => {
		const result = emptyResult(spec("a"), "running");
		applyJsonLine(result, toolExecutionStartLine("tc1"));
		applyJsonLine(result, toolExecutionUpdateLine("tc1", "partial"));
		expect(applyJsonLine(result, toolExecutionEndLine("tc1", "final", false))).toBe(true);
		expect(result.toolOutputs.get("tc1")).toBe("final");
	});
});
