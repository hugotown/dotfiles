import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cancelRun, cleanupReport, recoverRun, resetNodeForRetry } from "./run-control.ts";
import { loadRun, saveRun } from "./state.ts";

function home(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "daddy-control-")); }

test("cancelRun marks a run cancelled and preserves node outputs", () => {
  const h = home();
  saveRun(h, { id: "r1", workflow: "w", arguments: "", status: "running", artifacts_dir: "/a", base_branch: "main", started_at: "t", nodes: { a: { status: "running", output: "partial" } } });
  const text = cancelRun(h, "r1", "not needed");
  expect(text).toContain("Run r1 cancelled");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("cancelled");
  expect(run?.nodes.a.output).toBe("partial");
  expect(run?.nodes.a.status).toBe("cancelled");
});

test("recoverRun marks old running run as failed", () => {
  const h = home();
  saveRun(h, { id: "r1", workflow: "w", arguments: "", status: "running", artifacts_dir: "/a", base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", nodes: { a: { status: "running", output: "" } } });
  const text = recoverRun(h, "r1");
  expect(text).toContain("recovered as failed");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("failed");
  expect(run?.nodes.a.status).toBe("failed");
});

test("resetNodeForRetry removes selected node and downstream node state", () => {
  const h = home();
  saveRun(h, {
    id: "r1", workflow: "w", arguments: "", status: "failed", artifacts_dir: "/a", base_branch: "main", started_at: "t",
    nodes: {
      a: { status: "completed", output: "a" },
      b: { status: "failed", output: "", error: "boom" },
      c: { status: "skipped", output: "" },
    },
  });
  const text = resetNodeForRetry(h, "r1", "b", [{ id: "a", bash: "echo a" }, { id: "b", bash: "echo b", depends_on: ["a"] }, { id: "c", bash: "echo c", depends_on: ["b"] }]);
  expect(text).toContain("Reset b, c");
  const run = loadRun(h, "r1");
  expect(run?.status).toBe("running");
  expect(run?.nodes.a.status).toBe("completed");
  expect(run?.nodes.b).toBeUndefined();
  expect(run?.nodes.c).toBeUndefined();
});

test("cleanupReport lists old terminal runs without deleting", () => {
  const h = home();
  saveRun(h, { id: "old", workflow: "w", arguments: "", status: "completed", artifacts_dir: "/a", base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", completed_at: "2020-01-01T00:01:00.000Z", nodes: {} });
  const text = cleanupReport(h, new Date("2026-06-16T00:00:00.000Z"));
  expect(text).toContain("Cleanup candidates");
  expect(text).toContain("old completed");
});
