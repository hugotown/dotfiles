// nodes/loop.test.ts
import { test, expect } from "bun:test";
import { runLoop } from "./loop.ts";
import type { RunCtx, PiRunResult } from "../runtime-types.ts";

const ctx = (loop: object): RunCtx => ({
  node: { id: "n", loop } as RunCtx["node"],
  state: {} as RunCtx["state"],
  deps: { defaultProvider: "p", defaultModel: "m", exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
  sub: { builtins: {}, nodeOutputs: {}, nodeStructured: {} },
  cwd: "/p",
});

test("loops until signal then completes (strips tags)", async () => {
  let i = 0;
  const run = async (): Promise<PiRunResult> => {
    i++;
    const out = i < 3 ? "working" : "result\n<promise>COMPLETE</promise>";
    return { output: out, status: "ok", exitCode: 0, stderr: "", messages: [] };
  };
  const r = await runLoop(ctx({ prompt: "go", until: "COMPLETE", max_iterations: 5 }), run);
  expect(r.status).toBe("completed");
  expect(r.output).toBe("result");
  expect(i).toBe(3);
});

test("fails when max_iterations exceeded", async () => {
  const run = async (): Promise<PiRunResult> => ({ output: "still going", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runLoop(ctx({ prompt: "go", until: "DONE", max_iterations: 2 }), run);
  expect(r.status).toBe("failed");
  expect(r.error).toMatch(/exceeded 2/);
});

test("passes $LOOP_PREV_OUTPUT into the next iteration", async () => {
  const seen: string[] = [];
  let i = 0;
  const run = async (o: { task: string }): Promise<PiRunResult> => {
    seen.push(o.task); i++;
    return { output: i < 2 ? "one" : "<promise>DONE</promise>", status: "ok", exitCode: 0, stderr: "", messages: [] };
  };
  await runLoop(ctx({ prompt: "prev=$LOOP_PREV_OUTPUT", until: "DONE", max_iterations: 3 }), run as never);
  expect(seen[0]).toBe("prev=");
  expect(seen[1]).toBe("prev=one");
});

test("completes when until_bash passes", async () => {
  const c = ctx({ prompt: "go", until: "NEVER", until_bash: "true", max_iterations: 5 });
  const run = async (): Promise<PiRunResult> => ({ output: "working", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runLoop(c, run);
  expect(r.status).toBe("completed");
});
