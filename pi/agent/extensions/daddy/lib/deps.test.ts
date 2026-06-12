// lib/deps.test.ts
import { test, expect } from "bun:test";
import { makeDeps } from "./deps.ts";

const fakePi = { exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) };
const makeCtx = () => {
  const calls = { working: [] as (string | undefined)[], status: [] as (string | undefined)[] };
  const ctx = {
    cwd: "/proj",
    ui: {
      notify: () => {},
      setStatus: (_k: string, t: string | undefined) => calls.status.push(t),
      setWorkingMessage: (m?: string) => calls.working.push(m),
    },
    model: { provider: "anthropic", id: "claude-sonnet-4" },
  };
  return { ctx, calls };
};

const runningState = { workflow: "w", status: "running", nodes: { a: { status: "running", output: "" }, b: { status: "pending", output: "" } } };

test("maps pi/ctx into RunDeps", () => {
  const { ctx } = makeCtx();
  const d = makeDeps(fakePi as never, ctx as never);
  expect(d.projectDir).toBe("/proj");
  expect(d.home).toBe("/proj/.daddy");
  expect(d.defaultProvider).toBe("anthropic");
  expect(d.defaultModel).toBe("claude-sonnet-4");
  expect(typeof d.exec).toBe("function");
});

test("tolerates missing model", () => {
  const { ctx } = makeCtx();
  const d = makeDeps(fakePi as never, { ...ctx, model: undefined } as never);
  expect(d.defaultModel).toBeUndefined();
});

test("emit sets a live working message while running", () => {
  const { ctx, calls } = makeCtx();
  makeDeps(fakePi as never, ctx as never).emit(runningState as never);
  expect(calls.working[0]).toBe("w: running a (0/2)");
});

test("emit clears the working message when not running", () => {
  const { ctx, calls } = makeCtx();
  makeDeps(fakePi as never, ctx as never).emit({ ...runningState, status: "paused" } as never);
  expect(calls.working[0]).toBeUndefined();
});

test("progress streams a node snippet to the working message", () => {
  const { ctx, calls } = makeCtx();
  makeDeps(fakePi as never, ctx as never).progress?.("design", "line one\nline two");
  expect(calls.working[0]).toBe("design: line one line two");
});
