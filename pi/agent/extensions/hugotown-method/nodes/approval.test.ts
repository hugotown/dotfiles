// nodes/approval.test.ts
import { test, expect } from "bun:test";
import { runApproval } from "./approval.ts";
import type { RunCtx } from "../runtime-types.ts";

test("returns paused with substituted message + notifies", () => {
  const msgs: string[] = [];
  const ctx: RunCtx = {
    node: { id: "gate", approval: { message: "Review $ARGUMENTS" } },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: (m) => msgs.push(m), emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub: { builtins: { ARGUMENTS: "#42" }, nodeOutputs: {}, nodeStructured: {} },
    cwd: "/p",
  };
  const r = runApproval(ctx);
  expect(r.status).toBe("paused");
  expect(r.output).toBe("Review #42");
  expect(msgs[0]).toContain("Review #42");
});
