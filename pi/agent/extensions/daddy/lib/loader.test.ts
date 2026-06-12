// lib/loader.test.ts
import { test, expect } from "bun:test";
import { parseWorkflow } from "./loader.ts";

test("parses a minimal workflow", () => {
  const def = parseWorkflow('name: w\ndescription: d\nnodes:\n  - id: a\n    bash: "echo hi"');
  expect(def.name).toBe("w");
  expect(def.nodes).toHaveLength(1);
  expect(def.nodes[0].id).toBe("a");
});

test("throws when name missing", () => {
  expect(() => parseWorkflow('description: d\nnodes:\n  - id: a\n    bash: x')).toThrow(/name/);
});

test("throws when nodes empty", () => {
  expect(() => parseWorkflow("name: w\ndescription: d\nnodes: []")).toThrow(/nodes/);
});
