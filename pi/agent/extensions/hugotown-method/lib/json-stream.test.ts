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
