// lib/json-stream.ts — Apply one NDJSON line from `pi --mode json` to a PiRunResult.
import type { PiRunResult } from "../runtime-types.ts";

interface SubMsg {
  role: string;
  content: Array<{ type: string; text?: string; thinking?: string }>;
  stopReason?: string;
  errorMessage?: string;
}

export function finalText(messages: SubMsg[]): string {
  let latest = "";
  let seenText = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (!seenText) {
      for (const p of m.content) {
        if (p.type === "text" && typeof p.text === "string") {
          latest = p.text;
          seenText = true;
          break;
        }
      }
    }
  }
  return latest;
}

export function finalThinking(messages: SubMsg[]): string {
  // Only the most recent assistant message carries the final accumulated thinking
  // block. The previous block has already been folded into the running total.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    let out = "";
    for (const p of m.content) if (p.type === "thinking" && typeof p.thinking === "string") out += p.thinking;
    if (out) return out;
  }
  return "";
}

function deltaStr(evt: { type?: string; delta?: unknown }): { kind: "text" | "thinking" | "toolcall"; value: string } | undefined {
  // Only incremental *_delta events accumulate. The matching *_end event carries the
  // full block content already built by the deltas, so appending it would duplicate it;
  // message_end provides the authoritative final value instead.
  if (evt.type === "text_delta" || evt.type === "thinking_delta" || evt.type === "toolcall_delta") {
    if (typeof evt.delta !== "string") return undefined;
    const kind = evt.type === "thinking_delta" ? "thinking" : evt.type === "text_delta" ? "text" : "toolcall";
    return { kind, value: evt.delta };
  }
  return undefined;
}

export function applyJsonLine(result: PiRunResult, line: string): boolean {
  if (!line.trim()) return false;
  let ev: { type?: string; message?: SubMsg; assistantMessageEvent?: { type?: string; delta?: unknown; content?: unknown } };
  try { ev = JSON.parse(line); } catch { return false; }
  if (ev.type === "message_update" && ev.assistantMessageEvent) {
    const d = deltaStr(ev.assistantMessageEvent);
    if (!d) return false;
    if (d.kind === "thinking") {
      result.thinking = (result.thinking ?? "") + d.value;
      return true;
    }
    if (d.kind === "text") {
      result.output += d.value;
      return true;
    }
    // toolcall_delta is still surfaced for live progress but does not pollute the final output.
    return false;
  }
  if (ev.message && (ev.type === "message_end" || ev.type === "tool_result_end")) {
    (result.messages as SubMsg[]).push(ev.message);
    if (ev.type === "message_end" && ev.message.role === "assistant") {
      if (ev.message.stopReason) result.stopReason = ev.message.stopReason;
      if (ev.message.errorMessage) result.errorMessage = ev.message.errorMessage;
    }
    result.output = finalText(result.messages as SubMsg[]) || result.output;
    result.thinking = finalThinking(result.messages as SubMsg[]) || (result.thinking ?? "");
    return true;
  }
  return false;
}
