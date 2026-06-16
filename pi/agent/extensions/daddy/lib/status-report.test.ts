import { expect, test } from "bun:test";
import { buildStatusReport } from "./status-report.ts";
import type { RunState } from "../runtime-types.ts";

const run: RunState = {
  id: "r1",
  workflow: "fix-issue",
  arguments: "#42",
  status: "paused",
  paused_node: "gate",
  artifacts_dir: "/repo/.daddy/artifacts/r1",
  base_branch: "main",
  started_at: "2026-06-16T00:00:00.000Z",
  worktree: { branch: "daddy/fix-issue-r1", path: "/tmp/wt" },
  nodes: {
    plan: { status: "completed", output: "Plan", attempts: 1, model: "claude", started_at: "2026-06-16T00:00:00.000Z", completed_at: "2026-06-16T00:01:00.000Z" },
    gate: { status: "paused", output: "Approve?" },
  },
};

test("buildStatusReport includes run metadata and actions", () => {
  const text = buildStatusReport(run, "/repo/.daddy/runs/r1.json");
  expect(text).toContain("Run r1 — paused");
  expect(text).toContain("workflow: fix-issue");
  expect(text).toContain("paused node: gate");
  expect(text).toContain("worktree: daddy/fix-issue-r1 at /tmp/wt");
  expect(text).toContain("artifacts: /repo/.daddy/artifacts/r1");
  expect(text).toContain("plan completed");
  expect(text).toContain("gate paused");
  expect(text).toContain("next actions: /daddy approve");
});
