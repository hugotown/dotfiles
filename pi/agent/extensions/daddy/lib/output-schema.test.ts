// lib/output-schema.test.ts
import { test, expect } from "bun:test";
import { enforceOutput } from "./output-schema.ts";
import type { JsonSchema } from "../types.ts";

const schema: JsonSchema = {
  type: "object",
  properties: { type: { type: "string" } },
  required: ["type"],
};

test("accepts raw JSON", () => {
  const r = enforceOutput('{"type":"bug"}', schema);
  expect(r.ok).toBe(true);
  if (r.ok) expect((r.data as { type: string }).type).toBe("bug");
});

test("extracts JSON from fenced block", () => {
  const r = enforceOutput("Here:\n```json\n{\"type\":\"feat\"}\n```", schema);
  expect(r.ok).toBe(true);
});

test("rejects missing required field", () => {
  const r = enforceOutput('{"x":1}', schema);
  expect(r.ok).toBe(false);
});

test("rejects non-JSON", () => {
  expect(enforceOutput("not json", schema).ok).toBe(false);
});
