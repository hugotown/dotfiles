// lib/run-controller.test.ts
import { test, expect } from "bun:test";
import { startRun, resumeRun } from "./run-controller.ts";
import type { RunDeps } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-rc-b-"));
fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
fs.writeFileSync(path.join(bundled, "workflows", "gated.yaml"),
  "name: gated\ndescription: d\nnodes:\n" +
  "  - id: gate\n    approval: { message: review }\n" +
  "  - id: done\n    bash: echo done\n    depends_on: [gate]\n");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-rc-h-"));
const deps: RunDeps = {
  exec: (async (_c, a) => ({ stdout: a.includes("--show-current") ? "main\n" : "", stderr: "", code: a.includes("symbolic-ref") ? 1 : 0, killed: false })) as RunDeps["exec"],
  notify: () => {}, emit: () => {}, home, bundledDir: bundled, projectDir: process.cwd(),
};

test("startRun pauses at the gate", async () => {
  const s = await startRun("gated", "#1", deps);
  expect(s.status).toBe("paused");
  expect(s.paused_node).toBe("gate");
});

test("approve resumes and completes downstream", async () => {
  const s = await startRun("gated", "#2", deps);
  const r = await resumeRun(s.id, deps, { decision: "approve", comment: "lgtm" });
  expect(r.status).toBe("completed");
  expect(r.nodes.gate.output).toBe("lgtm");
  expect(r.nodes.done.status).toBe("completed");
});

test("missing workflow throws", async () => {
  await expect(startRun("nope", "", deps)).rejects.toThrow(/not found/);
});
