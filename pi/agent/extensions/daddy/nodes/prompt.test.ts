// nodes/prompt.test.ts
import { test, expect } from "bun:test";
import { runPrompt, runAiTask } from "./prompt.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";

const okRun = async (): Promise<PiRunResult> =>
  ({ output: '{"type":"bug"}', status: "ok", exitCode: 0, stderr: "", messages: [] });

const ctx = (overrides = {}): RunCtx => ({
  node: { id: "n", prompt: "Classify $ARGUMENTS", ...overrides },
  state: {} as RunCtx["state"],
  deps: { defaultProvider: "anthropic", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
  sub: { builtins: { ARGUMENTS: "#42" }, nodeOutputs: {}, nodeStructured: {} },
  cwd: "/p",
});

test("runs AI task and returns completed output", async () => {
  const r = await runPrompt(ctx(), okRun);
  expect(r.status).toBe("completed");
});

test("validates output_format and exposes structured data", async () => {
  const r = await runAiTask(ctx({ output_format: { type: "object", required: ["type"] } }), "x", okRun);
  expect(r.status).toBe("completed");
  expect((r.structured as { type: string }).type).toBe("bug");
});

test("fails when output_format unmet", async () => {
  const bad = async (): Promise<PiRunResult> => ({ output: "{}", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runAiTask(ctx({ output_format: { type: "object", required: ["type"] } }), "x", bad);
  expect(r.status).toBe("failed");
});

test("fails when no model resolved", async () => {
  const c = ctx(); c.deps = { ...c.deps, defaultModel: undefined };
  const r = await runAiTask(c, "x", okRun);
  expect(r.status).toBe("failed");
});

test("fails when run returns failed", async () => {
  const failRun = async (): Promise<PiRunResult> => ({ output: "x", status: "failed", exitCode: 1, stderr: "boom", messages: [] });
  const r = await runAiTask(ctx(), "x", failRun);
  expect(r.status).toBe("failed");
  expect(r.error).toBe("boom");
});
