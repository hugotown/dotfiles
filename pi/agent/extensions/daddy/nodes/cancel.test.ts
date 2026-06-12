// nodes/cancel.test.ts
import { test, expect } from "bun:test";
import { runCancel } from "./cancel.ts";
import type { RunCtx } from "../runtime-types.ts";

test("returns cancelled with substituted reason", () => {
  const ctx: RunCtx = {
    node: { id: "c", cancel: "Refusing on $BASE_BRANCH" },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: { BASE_BRANCH: "main" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = runCancel(ctx);
  expect(r.status).toBe("cancelled");
  expect(r.output).toBe("Refusing on main");
});
