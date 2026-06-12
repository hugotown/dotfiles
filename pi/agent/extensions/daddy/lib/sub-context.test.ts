// lib/sub-context.test.ts
import { test, expect } from "bun:test";
import { buildSubContext } from "./sub-context.ts";
import type { RunState, RunDeps } from "../runtime-types.ts";

const deps = { home: "/h" } as RunDeps;
const state: RunState = {
  id: "id1", workflow: "w", arguments: "#42", status: "running",
  artifacts_dir: "/art", base_branch: "main", started_at: "t",
  nodes: {
    classify: { status: "completed", output: '{"type":"bug"}', structured: { type: "bug" } },
    pending1: { status: "pending", output: "" },
  },
};

test("builds builtins from state", () => {
  const sub = buildSubContext(state, deps);
  expect(sub.builtins.ARGUMENTS).toBe("#42");
  expect(sub.builtins.ARTIFACTS_DIR).toBe("/art");
  expect(sub.builtins.WORKFLOW_ID).toBe("id1");
});

test("exposes only completed node outputs + structured", () => {
  const sub = buildSubContext(state, deps);
  expect(sub.nodeOutputs.classify).toBe('{"type":"bug"}');
  expect(sub.nodeStructured.classify).toEqual({ type: "bug" });
  expect("pending1" in sub.nodeOutputs).toBe(false);
});
