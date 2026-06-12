// lib/git-info.test.ts
import { test, expect } from "bun:test";
import { detectBaseBranch } from "./git-info.ts";
import type { ExecLike } from "../runtime-types.ts";

test("reads origin/HEAD when available", async () => {
  const exec: ExecLike = async (_c, args) =>
    args.includes("symbolic-ref")
      ? { stdout: "refs/remotes/origin/main\n", stderr: "", code: 0, killed: false }
      : { stdout: "", stderr: "", code: 1, killed: false };
  expect(await detectBaseBranch(exec, "/repo")).toBe("main");
});

test("falls back to current branch then 'main'", async () => {
  const exec: ExecLike = async (_c, args) =>
    args.includes("--show-current")
      ? { stdout: "dev\n", stderr: "", code: 0, killed: false }
      : { stdout: "", stderr: "", code: 1, killed: false };
  expect(await detectBaseBranch(exec, "/repo")).toBe("dev");
});
