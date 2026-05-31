// Parse STATUS lines from subagent output.
// Used by both implementation and test generation dispatchers.

import type { ImplementationResult, TestGenerationResult } from "./state.ts";

/**
 * Parse the required STATUS line from an implementer subagent's final text.
 * Format: `STATUS: <DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT> | CONCERNS: <text>`.
 */
export function parseImplStatus(text: string): { status: ImplementationResult["status"]; concerns: string | null } {
  const m = text.match(/STATUS\s*:\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)\s*(?:\|\s*CONCERNS\s*:\s*([^\n]*))?/i);
  if (!m) return { status: "BLOCKED", concerns: "no STATUS line in subagent output" };
  const status = m[1].toUpperCase() as ImplementationResult["status"];
  const raw = (m[2] ?? "").trim();
  return { status, concerns: raw && raw.toLowerCase() !== "none" ? raw : null };
}

/** Parse STATUS line from a test-generator subagent's final text. */
export function parseTestStatus(text: string): { status: TestGenerationResult["status"]; concerns: string | null } {
  const m = text.match(/STATUS\s*:\s*(DONE|BLOCKED)\s*(?:\|\s*CONCERNS\s*:\s*([^\n]*))?/i);
  if (!m) return { status: "BLOCKED", concerns: "no STATUS line in subagent output" };
  const status = m[1].toUpperCase() as TestGenerationResult["status"];
  const raw = (m[2] ?? "").trim();
  return { status, concerns: raw && raw.toLowerCase() !== "none" ? raw : null };
}
