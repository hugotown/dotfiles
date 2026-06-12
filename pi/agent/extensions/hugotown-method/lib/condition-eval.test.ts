// lib/condition-eval.test.ts
import { test, expect } from "bun:test";
import { evaluateCondition } from "./condition-eval.ts";
import type { SubContext } from "../runtime-types.ts";

const ctx: SubContext = {
  builtins: {},
  nodeOutputs: { gate: "approved", score: "85" },
  nodeStructured: { classify: { type: "bug" } },
};

test("string equality", () => {
  expect(evaluateCondition("$gate.output == 'approved'", ctx)).toBe(true);
  expect(evaluateCondition("$gate.output == 'rejected'", ctx)).toBe(false);
});

test("structured field equality", () => {
  expect(evaluateCondition("$classify.output.type == 'bug'", ctx)).toBe(true);
});

test("numeric comparison", () => {
  expect(evaluateCondition("$score.output > '80'", ctx)).toBe(true);
  expect(evaluateCondition("$score.output < '80'", ctx)).toBe(false);
});

test("compound && binds tighter than ||", () => {
  expect(evaluateCondition("$gate.output == 'x' || $score.output >= '85'", ctx)).toBe(true);
});

test("invalid expression fails closed", () => {
  expect(evaluateCondition("$missing.output >", ctx)).toBe(false);
});
