// lib/json-stream.test.ts
import { test, expect } from "bun:test";
import { applyJsonLine, finalText } from "./json-stream.ts";
import type { PiRunResult } from "../runtime-types.ts";

const empty = (): PiRunResult => ({ output: "", status: "ok", exitCode: 0, stderr: "", messages: [] });

test("accumulates text_delta", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hel" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "lo" } }));
  expect(r.output).toBe("Hello");
});

test("accumulates thinking and ignores toolcall deltas", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "Thinking" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "toolcall_delta", delta: " with tool" } }));
  expect(r.output).toBe("");
  expect(r.thinking).toBe("Thinking");
});

test("thinking_end does not duplicate accumulated thinking deltas", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "Plan " } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "step" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "thinking_end", content: "Plan step" } }));
  expect(r.thinking).toBe("Plan step");
});

test("text_end does not duplicate accumulated text deltas", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hel" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "lo" } }));
  applyJsonLine(r, JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_end", content: "Hello" } }));
  expect(r.output).toBe("Hello");
});

test("captures thinking from message_end using real pi 'thinking' field", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({
    type: "message_end",
    message: { role: "assistant", content: [
      { type: "thinking", thinking: "Plan", thinkingSignature: "sig" },
      { type: "text", text: "What is your name?" },
    ] },
  }));
  expect(r.thinking).toBe("Plan");
  expect(r.output).toBe("What is your name?");
});

test("separates thinking and text from message_end assistant content", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({
    type: "message_end",
    message: { role: "assistant", content: [
      { type: "thinking", thinking: "Plan" },
      { type: "text", text: "Result" },
    ] },
  }));
  expect(r.thinking).toBe("Plan");
  expect(r.output).toBe("Result");
});

test("final output from message_end assistant text", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Final" }] } }));
  expect(r.output).toBe("Final");
});

test("captures stopReason error", () => {
  const r = empty();
  applyJsonLine(r, JSON.stringify({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "boom" } }));
  expect(r.stopReason).toBe("error");
  expect(r.errorMessage).toBe("boom");
});

test("ignores malformed lines", () => {
  const r = empty();
  expect(applyJsonLine(r, "not json")).toBe(false);
});

test("finalText prefers last assistant text", () => {
  expect(finalText([{ role: "assistant", content: [{ type: "text", text: "A" }] }] as never)).toBe("A");
});
