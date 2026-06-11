// Tolerant extraction of structured data from a subagent's final text:
// a fenced ```json block (preferred) and a single-line STATUS: token.

export function extractJsonBlock<T>(text: string): T | null {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    /* fall through to span scan */
  }
  const span = raw.match(/[\[{][\s\S]*[\]}]/);
  if (span) {
    try {
      return JSON.parse(span[0]) as T;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function extractStatus(text: string): string {
  const m = text.match(/STATUS:\s*([A-Z_]+)/i);
  return m ? m[1].toUpperCase() : "DONE";
}
