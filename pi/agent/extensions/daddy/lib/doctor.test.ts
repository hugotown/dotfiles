import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildDoctorReport } from "./doctor.ts";
import { saveRun } from "./state.ts";

test("doctor reports directories, workflows, commands, and stale running runs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daddy-doctor-"));
  const home = path.join(root, ".daddy");
  const bundled = path.join(root, "bundled");
  fs.mkdirSync(path.join(home, "workflows"), { recursive: true });
  fs.mkdirSync(path.join(home, "commands"), { recursive: true });
  fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
  fs.writeFileSync(path.join(home, "workflows", "ok.yaml"), "name: ok\ndescription: ok\nnodes:\n  - id: a\n    bash: echo hi\n");
  saveRun(home, { id: "r1", workflow: "ok", arguments: "", status: "running", artifacts_dir: path.join(home, "artifacts", "r1"), base_branch: "main", started_at: "2020-01-01T00:00:00.000Z", nodes: {} });
  const report = await buildDoctorReport({ home, projectDir: root, bundledDir: bundled, exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) });
  expect(report).toContain("Daddy doctor report");
  expect(report).toContain("workflows: 1 valid, 0 invalid");
  expect(report).toContain("stale running runs: r1");
});
