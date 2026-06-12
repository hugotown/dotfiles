// lib/git-info.ts — Detect the repository base branch via git (injected exec).
import type { ExecLike } from "../runtime-types.ts";

export async function detectBaseBranch(exec: ExecLike, cwd: string): Promise<string> {
  const head = await exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
  if (head.code === 0) {
    const m = head.stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (m) return m[1];
  }
  const cur = await exec("git", ["branch", "--show-current"], { cwd });
  return cur.code === 0 && cur.stdout.trim() ? cur.stdout.trim() : "main";
}
