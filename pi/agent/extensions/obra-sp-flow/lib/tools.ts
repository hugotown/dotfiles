// Canonical pi tool-name allowlists. Built-in tools (verified via `pi --help`):
// read, bash, edit, write, grep, find, ls. Note: ast-grep is a CLI used through
// `bash`, NOT a registered tool — never list it here.

import type { PhaseKey } from "../types.ts";

export const EXPLORE = ["read", "bash", "grep", "find", "ls"];

export const WRITE = [...EXPLORE, "write", "edit"];

// Gemini extension tools (referenced by name only; no cross-extension import).
export const GEMINI_RESEARCH = [
  "gemini_google_search",
  "gemini_deep_research_start",
  "gemini_deep_research_poll",
  "gemini_libraries",
];

/** Code default allowlist per phase (used when config `tools` is empty). */
export function defaultTools(key: PhaseKey): string[] {
  if (key === "brainstorm") return ["obra_spec", "ask_user_question", ...EXPLORE];
  return [...WRITE, ...GEMINI_RESEARCH];
}

/** Config override wins when non-empty; otherwise the code default. */
export function phaseTools(key: PhaseKey, override: string[]): string[] {
  return override.length ? override : defaultTools(key);
}
