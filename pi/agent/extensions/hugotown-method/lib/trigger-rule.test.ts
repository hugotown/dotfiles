// lib/trigger-rule.test.ts
import { test, expect } from "bun:test";
import { shouldExecute } from "./trigger-rule.ts";
import type { NodeState } from "../runtime-types.ts";

const st = (m: Record<string, string>): Record<string, NodeState> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { status: v as NodeState["status"], output: "" }]));

test("no deps always runs", () => {
  expect(shouldExecute({ id: "a", bash: "x" }, {})).toBe(true);
});

test("all_success requires every dep completed", () => {
  const n = { id: "c", bash: "x", depends_on: ["a", "b"] };
  expect(shouldExecute(n, st({ a: "completed", b: "completed" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "completed", b: "failed" }))).toBe(false);
});

test("none_failed_min_one_success allows skipped deps", () => {
  const n = { id: "c", bash: "x", depends_on: ["a", "b"], trigger_rule: "none_failed_min_one_success" as const };
  expect(shouldExecute(n, st({ a: "completed", b: "skipped" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "failed", b: "skipped" }))).toBe(false);
});

test("all_done waits for terminal states", () => {
  const n = { id: "c", bash: "x", depends_on: ["a"], trigger_rule: "all_done" as const };
  expect(shouldExecute(n, st({ a: "failed" }))).toBe(true);
  expect(shouldExecute(n, st({ a: "running" }))).toBe(false);
});
