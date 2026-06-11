// Thin git helpers for branch isolation (step 3) and finishing (step 8).
// Never touches protected branches; never force-pushes.

import { execSync } from "node:child_process";

export const PROTECTED = ["main", "master", "trunk"];

export interface GitOut {
  ok: boolean;
  out: string;
}

export function git(cwd: string, args: string): GitOut {
  try {
    const out = execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out: out.trim() };
  } catch (e: any) {
    return { ok: false, out: String(e?.stderr ?? e?.message ?? e).trim() };
  }
}

export function hasGit(cwd: string): boolean {
  return git(cwd, "rev-parse --is-inside-work-tree").ok;
}

export function currentBranch(cwd: string): string {
  return git(cwd, "rev-parse --abbrev-ref HEAD").out;
}

export function isDirty(cwd: string): boolean {
  return git(cwd, "status --porcelain").out.length > 0;
}

export function isProtected(branch: string): boolean {
  return PROTECTED.includes(branch);
}

export function branchExists(cwd: string, name: string): boolean {
  return git(cwd, `rev-parse --verify --quiet ${name}`).ok;
}

export function createBranch(cwd: string, name: string): GitOut {
  return git(cwd, `checkout -b ${name}`);
}

export function checkoutBranch(cwd: string, name: string): GitOut {
  return git(cwd, `checkout ${name}`);
}

/** SHA of the most recent commit touching `file`, or "" if none. */
export function lastCommitForFile(cwd: string, file: string): string {
  return git(cwd, `log -1 --format=%H -- ${file}`).out;
}

export function headSha(cwd: string): string {
  return git(cwd, "rev-parse HEAD").out;
}

export function baseSha(cwd: string, base: string): string {
  const mb = git(cwd, `merge-base HEAD ${base}`);
  return mb.ok ? mb.out : git(cwd, "rev-parse HEAD~1").out;
}

export function pushBranch(cwd: string, branch: string): GitOut {
  return git(cwd, `push -u origin ${branch}`);
}
