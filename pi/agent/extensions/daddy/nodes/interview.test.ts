// nodes/interview.test.ts
import { test, expect } from "bun:test";
import { runInterview } from "./interview.ts";
import type { PiRunResult, RunCtx } from "../runtime-types.ts";

const deps = {
  defaultProvider: "p",
  defaultModel: "m",
  exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"],
  notify: () => {},
  emit: () => {},
  home: "/h",
  bundledDir: "/b",
  projectDir: "/p",
};

const ctx = (interview: object, nodeState: RunCtx["state"]["nodes"][string] = { status: "pending", output: "" }): RunCtx => ({
  node: { id: "n", interview } as RunCtx["node"],
  state: {
    id: "r",
    workflow: "w",
    arguments: "",
    status: "running",
    artifacts_dir: "/a",
    base_branch: "main",
    started_at: "now",
    nodes: { n: nodeState },
  },
  deps,
  sub: { builtins: {}, nodeOutputs: {}, nodeStructured: {} },
  cwd: "/p",
});

test("pauses after asking the first interview question", async () => {
  const run = async (): Promise<PiRunResult> => ({ output: "What is your name?", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runInterview(ctx({ prompt: "ask", until: "DONE", max_iterations: 3 }), run);
  expect(r.status).toBe("paused");
  expect(r.output).toBe("What is your name?");
  expect(r.structured).toEqual({ iteration: 1, answers: [], last_output: "What is your name?" });
});

test("streams interview step context before asking", async () => {
  const streamed: string[] = [];
  const run = async (): Promise<PiRunResult> => ({ output: "What is your name?", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const c = ctx({ prompt: "ask", until: "DONE", max_iterations: 3 });
  c.deps = { ...c.deps, onStream: (_nodeId, text) => streamed.push(text) };
  await runInterview(c, run);
  expect(streamed).toContain("Interview step 1 - answers collected: 0");
});

test("passes the resumed answer and accumulated answers into the next prompt", async () => {
  const seen: string[] = [];
  const run = async (o: { task: string }): Promise<PiRunResult> => {
    seen.push(o.task);
    return { output: "What project?", status: "ok", exitCode: 0, stderr: "", messages: [] };
  };
  const r = await runInterview(ctx(
    { prompt: "answer=$LOOP_USER_INPUT prev=$LOOP_PREV_OUTPUT all=$LOOP_ANSWERS count=$LOOP_ANSWER_COUNT", until: "DONE", max_iterations: 3 },
    { status: "paused", output: "What is your name?", structured: { iteration: 1, answers: [], last_output: "What is your name?", pending_answer: "Hugo" } },
  ), run as never);
  expect(seen[0]).toBe('answer=Hugo prev=What is your name? all=["Hugo"] count=1');
  expect(r.status).toBe("paused");
  expect(r.structured).toEqual({ iteration: 2, answers: ["Hugo"], last_output: "What project?" });
});

test("completes when the interview emits the completion signal", async () => {
  const run = async (): Promise<PiRunResult> => ({ output: "Summary\n<promise>DONE</promise>", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runInterview(ctx(
    { prompt: "ask", until: "DONE", max_iterations: 3 },
    { status: "paused", output: "Goal?", structured: { iteration: 2, answers: ["Hugo", "Daddy"], last_output: "Goal?", pending_answer: "Fix panel" } },
  ), run);
  expect(r.status).toBe("completed");
  expect(r.output).toBe("Summary");
  expect(r.structured).toEqual({ iteration: 3, answers: ["Hugo", "Daddy", "Fix panel"], last_output: "Summary" });
});

test("fails when max interview iterations are exceeded", async () => {
  const run = async (): Promise<PiRunResult> => ({ output: "Another question", status: "ok", exitCode: 0, stderr: "", messages: [] });
  const r = await runInterview(ctx(
    { prompt: "ask", until: "DONE", max_iterations: 1 },
    { status: "paused", output: "Q1", structured: { iteration: 1, answers: [], last_output: "Q1", pending_answer: "A1" } },
  ), run);
  expect(r.status).toBe("failed");
  expect(r.error).toMatch(/exceeded 1/);
});
