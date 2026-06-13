// panel/stream-view.ts — Right column: streaming output renderer, tailed to height.
import type { StreamEntry } from "./store.ts";

function wordWrap(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const out: string[] = [];
  const words = text.split(/\s+/);
  let current = "";
  for (const w of words) {
    const candidate = current.length === 0 ? w : `${current} ${w}`;
    if (candidate.length > width) {
      if (current) out.push(current);
      current = w.length > width ? w.slice(0, width) : w;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [""];
}

function formatEntry(e: StreamEntry): string {
  if (e.type === "tool_call") return `→ ${e.content}`;
  if (e.type === "status") return `[${e.content}]`;
  return e.content;
}

function pad(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

export function renderStreamView(
  entries: StreamEntry[],
  width: number,
  height: number,
): string[] {
  if (height <= 0) return [];
  const allLines: string[] = [];
  for (const e of entries) {
    const formatted = formatEntry(e);
    for (const line of wordWrap(formatted, width)) allLines.push(line);
  }
  const tail = allLines.slice(-height);
  const padded = tail.map((l) => pad(l, width));
  while (padded.length < height) padded.unshift(" ".repeat(width));
  return padded;
}
