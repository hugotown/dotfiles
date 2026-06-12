// lib/json-stream.ts — Apply one NDJSON line from `pi --mode json` to a PiRunResult.
import type { PiRunResult } from "../runtime-types.ts";

interface SubMsg {
  role: string;
  content: Array<{ type: string; text?: string }>;
  stopReason?: string;
  errorMessage?: string;
}

export function finalText(messages: SubMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") for (const p of m.content) if (p.type === "text") return p.text ?? "";
  }
  return "";
}

function deltaStr(evt: { type?: string; delta?: unknown; content?: unknown }): string | undefined {
  if (evt.type === "text_delta") return typeof evt.delta === "string" ? evt.delta : undefined;
  if (evt.type === "text_end") return typeof evt.content === "string" ? evt.content : undefined;
  return undefined;
}

export function applyJsonLine(result: PiRunResult, line: string): boolean {
  if (!line.trim()) return false;
  let ev: { type?: string; message?: SubMsg; assistantMessageEvent?: { type?: string; delta?: unknown; content?: unknown } };
  try { ev = JSON.parse(line); } catch { return false; }
  if (ev.type === "message_update" && ev.assistantMessageEvent) {
    const d = deltaStr(ev.assistantMessageEvent);
    if (d) { result.output += d; return true; }
    return false;
  }
  if (ev.message && (ev.type === "message_end" || ev.type === "tool_result_end")) {
    (result.messages as SubMsg[]).push(ev.message);
    if (ev.type === "message_end" && ev.message.role === "assistant") {
      if (ev.message.stopReason) result.stopReason = ev.message.stopReason;
      if (ev.message.errorMessage) result.errorMessage = ev.message.errorMessage;
    }
    result.output = finalText(result.messages as SubMsg[]) || result.output;
    return true;
  }
  return false;
}
