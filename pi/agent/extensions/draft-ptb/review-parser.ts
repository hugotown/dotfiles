// Parse reviewer subagent JSON verdicts into ReviewDimensionResult.

import type { ReviewDimensionResult, ReviewIssue } from "./state.ts";

/**
 * Parse a reviewer's final assistant text as a ReviewDimensionResult JSON object.
 * Handles code fences, leading text, and malformed output gracefully.
 */
export function parseReviewVerdict(text: string, dimension: string): ReviewDimensionResult {
  const trimmed = text.trim();
  if (!trimmed) return fallbackVerdict(dimension, "empty output");

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : extractFirstJsonObject(trimmed);
  if (!candidate) return fallbackVerdict(dimension, "no JSON object found");

  let parsed: unknown;
  try { parsed = JSON.parse(candidate); } catch (e) {
    return fallbackVerdict(dimension, `JSON.parse failed: ${(e as Error).message}`);
  }

  if (!isValidVerdict(parsed)) return fallbackVerdict(dimension, "JSON did not match ReviewDimensionResult shape");
  return parsed;
}

function fallbackVerdict(dimension: string, reason: string): ReviewDimensionResult {
  return {
    approved: false,
    issues: [{
      severity: "critical", file: "(reviewer)", line: null,
      description: `${dimension} reviewer produced no parseable verdict: ${reason}`,
      fixSuggestion: "rerun the review — the reviewer subagent likely crashed or returned non-JSON",
    }],
  };
}

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

function isValidVerdict(v: unknown): v is ReviewDimensionResult {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.approved !== "boolean" || !Array.isArray(obj.issues)) return false;
  return obj.issues.every(isValidIssue);
}

function isValidIssue(v: unknown): v is ReviewIssue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!["critical", "important", "minor"].includes(o.severity as string)) return false;
  if (typeof o.file !== "string" || typeof o.description !== "string" || typeof o.fixSuggestion !== "string") return false;
  return o.line === null || typeof o.line === "number";
}
