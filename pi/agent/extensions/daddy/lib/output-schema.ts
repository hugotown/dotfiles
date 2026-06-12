// lib/output-schema.ts — Best-effort structured-output validation against a JsonSchema.
import type { JsonSchema } from "../types.ts";

type Result = { ok: true; data: unknown } | { ok: false; error: string };

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : raw).trim());
}

function checkType(v: unknown, schema: JsonSchema): boolean {
  switch (schema.type) {
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    case "array": return Array.isArray(v);
    case "number": case "integer": return typeof v === "number";
    case "boolean": return typeof v === "boolean";
    case "string": return typeof v === "string";
    default: return true;
  }
}

export function enforceOutput(raw: string, schema: JsonSchema): Result {
  let data: unknown;
  try { data = extractJson(raw); } catch { return { ok: false, error: "Output is not valid JSON" }; }
  if (!checkType(data, schema)) return { ok: false, error: `Expected ${schema.type}` };
  for (const req of schema.required ?? []) {
    if (!(req in (data as Record<string, unknown>))) return { ok: false, error: `Missing field "${req}"` };
  }
  return { ok: true, data };
}
