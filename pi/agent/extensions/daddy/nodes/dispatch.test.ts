// nodes/dispatch.test.ts
import { test, expect } from "bun:test";
import { nodeType, dispatchNode } from "./dispatch.ts";
import type { RunCtx } from "../runtime-types.ts";

test("identifies node type", () => {
  expect(nodeType({ id: "a", bash: "x" })).toBe("bash");
  expect(nodeType({ id: "a", interview: { prompt: "x", max_iterations: 1 } })).toBe("interview");
  expect(nodeType({ id: "a", cancel: "r" })).toBe("cancel");
});

test("throws on typeless node", () => {
  expect(() => nodeType({ id: "a" })).toThrow(/no type/);
});

test("routes cancel node to runCancel", async () => {
  const ctx: RunCtx = {
    node: { id: "c", cancel: "stop" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: {}, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  expect((await dispatchNode(ctx)).status).toBe("cancelled");
});
