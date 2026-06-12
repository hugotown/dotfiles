// lib/validator.test.ts
import { test, expect } from "bun:test";
import { validateWorkflow } from "./validator.ts";
import type { WorkflowDef } from "../types.ts";

const wf = (nodes: WorkflowDef["nodes"]): WorkflowDef => ({ name: "w", description: "d", nodes });

test("accepts a valid DAG", () => {
  expect(validateWorkflow(wf([
    { id: "a", bash: "x" }, { id: "b", bash: "y", depends_on: ["a"] },
  ]))).toBeNull();
});

test("rejects duplicate ids", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x" }, { id: "a", bash: "y" }]))).toMatch(/Duplicate/);
});

test("rejects two type fields", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x", prompt: "p" }]))).toMatch(/exactly one/);
});

test("rejects unknown dependency", () => {
  expect(validateWorkflow(wf([{ id: "a", bash: "x", depends_on: ["z"] }]))).toMatch(/unknown/);
});

test("rejects cycles", () => {
  expect(validateWorkflow(wf([
    { id: "a", bash: "x", depends_on: ["b"] }, { id: "b", bash: "y", depends_on: ["a"] },
  ]))).toMatch(/cycle/);
});

test("rejects retry on loop node", () => {
  expect(validateWorkflow(wf([
    { id: "a", loop: { prompt: "p", max_iterations: 1 }, retry: { max_attempts: 2 } },
  ]))).toMatch(/Loop/);
});
