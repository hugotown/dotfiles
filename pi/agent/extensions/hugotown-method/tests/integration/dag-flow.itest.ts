// tests/integration/dag-flow.itest.ts — End-to-end DAG with deterministic + AI nodes + approval resume.
import { test, expect } from "bun:test";
import { startRun, resumeRun } from "../../lib/run-controller.ts";
import { realExec, defaultModel } from "./helpers.ts";
import type { RunDeps } from "../../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

function project(): RunDeps {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ht-e2e-"));
  fs.mkdirSync(path.join(proj, ".hugotown", "workflows"), { recursive: true });
  const { provider, model } = defaultModel();
  fs.writeFileSync(path.join(proj, ".hugotown", "workflows", "demo.yaml"),
    "name: demo\ndescription: e2e\nnodes:\n" +
    "  - id: classify\n    prompt: 'Output JSON only: {\"type\":\"bug\"}'\n    output_format: { type: object, required: [type] }\n" +
    "  - id: branch\n    bash: 'echo handled $classify.output.type'\n    depends_on: [classify]\n" +
    "  - id: gate\n    approval: { message: review }\n    depends_on: [branch]\n" +
    "  - id: done\n    bash: 'echo finished'\n    depends_on: [gate]\n");
  return {
    exec: realExec as RunDeps["exec"], notify: () => {}, emit: () => {},
    home: path.join(proj, ".hugotown"), bundledDir: path.join(proj, ".hugotown"),
    projectDir: proj, defaultProvider: provider, defaultModel: model,
  };
}

test("AI classify -> bash branch -> approval pause -> resume -> done", async () => {
  const deps = project();
  const paused = await startRun("demo", "fix the bug", deps);
  expect(paused.status).toBe("paused");
  expect(paused.nodes.classify.status).toBe("completed");
  expect(paused.nodes.branch.output).toContain("handled bug");
  const done = await resumeRun(paused.id, deps, { decision: "approve" });
  expect(done.status).toBe("completed");
  expect(done.nodes.done.output).toBe("finished");
}, 120000);
