// tests/integration/wt.itest.ts — Exercises the real `wt` CLI in a temp git repo.
import { test, expect } from "bun:test";
import { wtCreate, wtPath, wtRemove } from "../../lib/wt.ts";
import { realExec, tempGitRepo } from "./helpers.ts";

test("create then remove a worktree", async () => {
  const repo = tempGitRepo();
  const branch = `hugotown/it-${Date.now().toString(36)}`;
  const { path } = await wtCreate(realExec, branch, repo);
  expect(await wtPath(realExec, branch, repo)).toBe(path);
  await wtRemove(realExec, branch, repo);
  expect(await wtPath(realExec, branch, repo)).toBeNull();
}, 60000);
