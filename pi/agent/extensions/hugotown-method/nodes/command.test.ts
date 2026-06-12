// nodes/command.test.ts
import { test, expect } from "bun:test";
import { runCommand } from "./command.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-cmd-h-"));
fs.mkdirSync(path.join(bundled, "commands"), { recursive: true });
fs.writeFileSync(path.join(bundled, "commands", "investigate.md"), "Investigate: $ARGUMENTS");

const capture = { task: "" };
const fakeRun = async (o: { task: string }): Promise<PiRunResult> => {
  capture.task = o.task;
  return { output: "done", status: "ok", exitCode: 0, stderr: "", messages: [] };
};

test("loads template, substitutes, runs", async () => {
  const ctx: RunCtx = {
    node: { id: "n", command: "investigate" },
    state: {} as RunCtx["state"],
    deps: { defaultProvider: "p", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: bundled, projectDir: "/nope" },
    sub: { builtins: { ARGUMENTS: "#7" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = await runCommand(ctx, fakeRun as never);
  expect(r.status).toBe("completed");
  expect(capture.task).toBe("Investigate: #7");
});
