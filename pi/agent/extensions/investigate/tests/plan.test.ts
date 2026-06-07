import { describe, expect, test } from "bun:test";
import { parsePlannerOutput } from "../lib/plan.ts";
import { PlannerOutputError } from "../types.ts";

describe("parsePlannerOutput", () => {
  test("clean JSON array of N strings parses", () => {
    const out = '["a?", "b?", "c?"]';
    expect(parsePlannerOutput(out, 3)).toEqual(["a?", "b?", "c?"]);
  });

  test("embedded JSON array surrounded by prose is extracted", () => {
    const out = 'Sure, here are the sub-questions:\n\n["q1", "q2"]\n\nLet me know if you need more.';
    expect(parsePlannerOutput(out, 2)).toEqual(["q1", "q2"]);
  });

  test("wraps codefenced JSON", () => {
    const out = "```json\n[\"x\", \"y\", \"z\", \"w\", \"v\"]\n```";
    expect(parsePlannerOutput(out, 5)).toEqual(["x", "y", "z", "w", "v"]);
  });

  test("wrong count throws PlannerOutputError", () => {
    expect(() => parsePlannerOutput('["a", "b"]', 3)).toThrow(PlannerOutputError);
  });

  test("non-string elements throw", () => {
    expect(() => parsePlannerOutput('["a", 42, "c"]', 3)).toThrow(PlannerOutputError);
  });

  test("no array found throws", () => {
    expect(() => parsePlannerOutput("Sorry I cannot help.", 3)).toThrow(PlannerOutputError);
  });

  test("empty strings throw", () => {
    expect(() => parsePlannerOutput('["a", "", "c"]', 3)).toThrow(PlannerOutputError);
  });
});
