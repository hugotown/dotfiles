import { test, expect } from "bun:test";
import { Value } from "typebox/value";
import { RunWorkflowParams } from "./schema.ts";

test("accepts a valid flow param", () => {
  expect(Value.Check(RunWorkflowParams, { flow: "fix-issue" })).toBe(true);
});

test("accepts flow + arguments", () => {
  expect(Value.Check(RunWorkflowParams, { flow: "fix-issue", arguments: "#42" })).toBe(true);
});

test("rejects missing flow", () => {
  expect(Value.Check(RunWorkflowParams, { arguments: "x" })).toBe(false);
});
