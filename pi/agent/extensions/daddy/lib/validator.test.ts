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

test("accepts an interview node", () => {
  expect(validateWorkflow(wf([
    { id: "a", interview: { prompt: "p", max_iterations: 1 } },
  ]))).toBeNull();
});

test("accepts valid acceptance config", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    acceptance: { level: "verified", verify: [{ id: "unit", command: "bun test", timeout_ms: 1000 }] },
    nodes: [{ id: "a", bash: "echo hi" }],
  })).toBeNull();
});

test("rejects invalid acceptance level", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    acceptance: { level: "magic" },
    nodes: [{ id: "a", bash: "echo hi" }],
  } as never)).toContain("Invalid acceptance level");
});

test("rejects verify entries without command", () => {
  expect(validateWorkflow({
    name: "w", description: "w",
    nodes: [{ id: "a", bash: "echo hi", acceptance: { level: "verified", verify: [{ id: "unit" }] } }],
  } as never)).toContain("Acceptance verify entry");
});
