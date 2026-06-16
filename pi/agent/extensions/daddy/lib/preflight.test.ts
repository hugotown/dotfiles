import { expect, test } from "bun:test";
import { buildPreflightReport } from "./preflight.ts";
import type { WorkflowDef } from "../types.ts";

test("preflight summarizes DAG and side effects", () => {
  const def: WorkflowDef = {
    name: "ship", description: "ship", worktree: true,
    nodes: [
      { id: "test", bash: "bun test" },
      { id: "pr", bash: "gh pr create", depends_on: ["test"] },
    ],
  };
  const text = buildPreflightReport(def, "#42");
  expect(text).toContain("Preflight: ship");
  expect(text).toContain("worktree: enabled");
  expect(text).toContain("test -> pr");
  expect(text).toContain("side effects: gh pr create");
  expect(text).toContain("warning: no acceptance configured");
});
