// lib/completion.ts — Loop completion-signal detection + tag stripping.
import { COMPLETION_SIGNAL_DEFAULTS } from "../constants.ts";

const TAG = /<promise>\s*([\s\S]*?)\s*<\/promise>/i;

export function detectSignal(output: string, until?: string): boolean {
  const target = (until ?? "").trim();
  const tag = output.match(TAG);
  if (tag) {
    const val = tag[1].trim().toLowerCase();
    if (target) return val === target.toLowerCase();
    return COMPLETION_SIGNAL_DEFAULTS.some((s) => s.toLowerCase() === val);
  }
  const signals = target ? [target] : COMPLETION_SIGNAL_DEFAULTS;
  const body = output.trim().toLowerCase();
  const tail = body.split("\n").pop()?.trim() ?? "";
  return signals.some((s) => tail === s.toLowerCase() || body.endsWith(s.toLowerCase()));
}

export function stripSignalTags(output: string): string {
  return output.replace(/<promise>[\s\S]*?<\/promise>/gi, "").trim();
}
