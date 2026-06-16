import { expect, test } from "bun:test";
import { applyAcceptance } from "./acceptance.ts";
import type { NodeResult, RunDeps } from "../runtime-types.ts";
import type { NodeDef, WorkflowDef } from "../types.ts";

const deps: RunDeps = {
  exec: async (_cmd, args) => ({ stdout: "", stderr: "", code: args.includes("fail") ? 1 : 0, killed: false }),
  notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p",
};

test("applyAcceptance marks no config as claimed for completed AI output", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", prompt: "work" } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  expect((await applyAcceptance(def, node, result, deps)).acceptance?.provenance).toBe("claimed");
});

test("applyAcceptance runs verify commands", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", bash: "echo", acceptance: { level: "verified", verify: [{ id: "unit", command: "pass" }] } } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  expect((await applyAcceptance(def, node, result, deps)).acceptance?.provenance).toBe("verified");
});

test("applyAcceptance rejects failed verify commands", async () => {
  const def = { name: "w", description: "w", nodes: [] } as WorkflowDef;
  const node = { id: "a", bash: "echo", acceptance: { level: "verified", verify: [{ id: "unit", command: "fail" }] } } as NodeDef;
  const result: NodeResult = { status: "completed", output: "done" };
  const checked = await applyAcceptance(def, node, result, deps);
  expect(checked.status).toBe("failed");
  expect(checked.acceptance?.provenance).toBe("rejected");
});
