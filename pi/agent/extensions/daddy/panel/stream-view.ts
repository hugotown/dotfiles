// panel/stream-view.ts — Right column: streaming output renderer, tailed to height.
import { paintMuted, type StreamEntry } from "./store.ts";

function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

// Hard line breaks (\n) are preserved so structured output (JSON, code) keeps its
// shape; lines that already fit are kept verbatim so indentation survives; only
// over-long lines are word-wrapped.
function wordWrap(text: string, width: number): string[] {
  if (width <= 0) return [];
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (visibleLength(raw) <= width) {
      out.push(raw);
      continue;
    }
    const words = raw.split(/\s+/);
    let current = "";
    for (const w of words) {
      const candidate = current.length === 0 ? w : `${current} ${w}`;
      if (visibleLength(candidate) > width) {
        if (current) out.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

function formatEntry(e: StreamEntry): string {
  if (e.type === "tool_call") return `→ ${e.content}`;
  if (e.type === "status") return `[${e.content}]`;
  return e.content;
}

function pad(text: string, width: number): string {
  if (width <= 0) return "";
  const visible = visibleLength(text);
  if (visible >= width) {
    return text.slice(0, Math.max(0, text.length - (visible - width)));
  }
  return text + " ".repeat(width - visible);
}

export function toLines(entries: StreamEntry[], width: number): string[] {
  const out: string[] = [];
  for (const e of entries) {
    // Color is applied per wrapped line so multi-line thinking stays muted on
    // every row (a block-level ANSI wrap would lose color after the first \n).
    for (const line of wordWrap(formatEntry(e), width)) {
      out.push(e.type === "thinking" ? paintMuted(line) : line);
    }
  }
  return out;
}

export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
  bottomOffset = 0,
): string[] {
  if (height <= 0) return [];
  const all = toLines(entries, width);
  const maxOffset = Math.max(0, all.length - height);
  const off = Math.min(Math.max(0, bottomOffset), maxOffset);
  const end = all.length - off;
  const start = Math.max(0, end - height);
  const win = all.slice(start, end);
  const padded = win.map((l) => pad(l, width));
  while (padded.length < height) padded.unshift(" ".repeat(width));
  return padded;
}
