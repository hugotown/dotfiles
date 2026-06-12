// lib/wt.ts — Worktree lifecycle via the `wt` CLI (injected exec).
import type { ExecLike } from "../runtime-types.ts";

export async function wtPath(exec: ExecLike, branch: string, cwd: string): Promise<string | null> {
  const r = await exec("wt", ["list", "--format=json"], { cwd });
  if (r.code !== 0) return null;
  try {
    const list = JSON.parse(r.stdout) as Array<{ branch?: string; path?: string }>;
    return list.find((w) => w.branch === branch)?.path ?? null;
  } catch { return null; }
}

export async function wtCreate(exec: ExecLike, branch: string, cwd: string): Promise<{ path: string }> {
  const r = await exec("wt", ["switch", "--create", branch], { cwd });
  if (r.code !== 0) throw new Error(`wt switch failed: ${r.stderr}`);
  const p = await wtPath(exec, branch, cwd);
  if (!p) throw new Error(`worktree path not found for ${branch}`);
  return { path: p };
}

export async function wtMerge(exec: ExecLike, cwd: string): Promise<void> {
  const r = await exec("wt", ["merge", "--yes"], { cwd });
  if (r.code !== 0) throw new Error(`wt merge failed: ${r.stderr}`);
}

export async function wtRemove(exec: ExecLike, branch: string, cwd: string): Promise<void> {
  await exec("wt", ["remove", branch, "--yes", "--force"], { cwd });
}
