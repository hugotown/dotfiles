// lib/summary.test.ts
import { test, expect } from "bun:test";
import { buildSummary } from "./summary.ts";
import type { RunState } from "../runtime-types.ts";

const state: RunState = {
  id: "1", workflow: "fix-issue", arguments: "", status: "paused",
  artifacts_dir: "/tmp", base_branch: "main", started_at: "t",
  paused_node: "gate",
  nodes: {
    classify: { status: "completed", output: "bug\nextra" },
    gate: { status: "paused", output: "" },
  },
};

test("summarizes nodes + pause hint", () => {
  const s = buildSummary(state);
  expect(s).toContain('Workflow "fix-issue" — paused');
  expect(s).toContain("✓ classify: completed — bug");
  expect(s).toContain('Paused at "gate"');
});
