// Git + gh CLI helpers for the ITERATE_OR_SHIP phase.
//
// All helpers are pure wrappers around `pi.exec` so they can be unit-tested by
// passing in a stub `Exec`. We never use `cd`, never spawn a shell, and never push
// to main/master (the caller is responsible for the branch check; we double-check).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Subset of the pi exec surface we need — makes tests trivial. */
export interface Exec {
  exec: ExtensionAPI["exec"];
}

const PROTECTED_BRANCHES = new Set(["main", "master", "trunk"]);

export async function detectGhCli(pi: Exec): Promise<boolean> {
  const r = await pi.exec("which", ["gh"], {});
  return r.code === 0 && r.stdout.trim().length > 0;
}

export async function hasStagedOrUnstagedChanges(pi: Exec, cwd: string): Promise<boolean> {
  // `git status --porcelain` prints nothing on a clean tree.
  const r = await pi.exec("git", ["status", "--porcelain"], { cwd });
  if (r.code !== 0) return false;
  return r.stdout.trim().length > 0;
}

export async function currentBranch(pi: Exec, cwd: string): Promise<string | null> {
  const r = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  if (r.code !== 0) return null;
  const name = r.stdout.trim();
  return name === "HEAD" ? null : name;
}

export interface CommitResult {
  committed: boolean;
  sha: string | null;
  reason: string | null;
}

/**
 * Stage everything and commit. No-op (committed=false, reason="nothing to commit")
 * when the working tree is clean. NEVER appends AI attribution to the message.
 */
export async function commitAll(pi: Exec, cwd: string, message: string): Promise<CommitResult> {
  const dirty = await hasStagedOrUnstagedChanges(pi, cwd);
  if (!dirty) return { committed: false, sha: null, reason: "nothing to commit" };

  const add = await pi.exec("git", ["add", "-A"], { cwd });
  if (add.code !== 0) return { committed: false, sha: null, reason: `git add failed: ${add.stderr.trim()}` };

  const commit = await pi.exec("git", ["commit", "-m", message], { cwd });
  if (commit.code !== 0) return { committed: false, sha: null, reason: `git commit failed: ${commit.stderr.trim()}` };

  const rev = await pi.exec("git", ["rev-parse", "HEAD"], { cwd });
  return { committed: true, sha: rev.code === 0 ? rev.stdout.trim() : null, reason: null };
}

export interface PushResult {
  pushed: boolean;
  reason: string | null;
}

/**
 * Push `branch` to `origin` with upstream tracking. Refuses to push if `branch` is in
 * the protected set (main/master/trunk).
 */
export async function pushBranch(pi: Exec, cwd: string, branch: string): Promise<PushResult> {
  if (PROTECTED_BRANCHES.has(branch)) {
    return { pushed: false, reason: `refusing to push protected branch: ${branch}` };
  }
  const r = await pi.exec("git", ["push", "-u", "origin", branch], { cwd });
  if (r.code !== 0) return { pushed: false, reason: r.stderr.trim() || `git push exited ${r.code}` };
  return { pushed: true, reason: null };
}

export interface PrResult {
  url: string | null;
  reason: string | null;
}

/**
 * Create a PR via `gh pr create`. Caller must have checked `detectGhCli` first;
 * if `gh` is missing this returns `{ url: null, reason: "gh CLI not installed" }`.
 */
export async function createPR(
  pi: Exec,
  cwd: string,
  baseBranch: string,
  title: string,
  body: string,
): Promise<PrResult> {
  if (!(await detectGhCli(pi))) return { url: null, reason: "gh CLI not installed" };
  const r = await pi.exec(
    "gh",
    ["pr", "create", "--base", baseBranch, "--title", title, "--body", body],
    { cwd },
  );
  if (r.code !== 0) return { url: null, reason: r.stderr.trim() || `gh pr create exited ${r.code}` };
  // `gh pr create` prints the URL on its last stdout line.
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  const url = lines.length > 0 ? lines[lines.length - 1].trim() : null;
  return { url: url && url.startsWith("http") ? url : null, reason: null };
}

export function isProtectedBranch(branch: string | null): boolean {
  return branch !== null && PROTECTED_BRANCHES.has(branch);
}
