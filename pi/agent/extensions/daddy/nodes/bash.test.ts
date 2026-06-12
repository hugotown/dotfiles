// nodes/bash.test.ts
import { test, expect } from "bun:test";
import { inlineOutputs, runBash } from "./bash.ts";
import type { RunCtx, SubContext } from "../runtime-types.ts";

const sub: SubContext = {
  builtins: { ARGUMENTS: "hello" },
  nodeOutputs: { prev: "a'b" },
  nodeStructured: {},
};

test("inlineOutputs shell-quotes node outputs", () => {
  expect(inlineOutputs("echo $prev.output", sub)).toBe("echo 'a'\\''b'");
});

test("inlineOutputs shell-quotes structured fields", () => {
  const s: SubContext = { builtins: {}, nodeOutputs: {}, nodeStructured: { classify: { type: "bug" } } };
  expect(inlineOutputs("echo $classify.output.type", s)).toBe("echo 'bug'");
});

test("runBash executes with builtins as env", async () => {
  const ctx: RunCtx = {
    node: { id: "n", bash: "echo $ARGUMENTS" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  const r = await runBash(ctx);
  expect(r.status).toBe("completed");
  expect(r.output).toBe("hello");
});

test("runBash fails on non-zero exit", async () => {
  const ctx: RunCtx = {
    node: { id: "n", bash: "exit 3" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  expect((await runBash(ctx)).status).toBe("failed");
});
