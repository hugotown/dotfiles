// Git repository detection.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitInfo } from "../state.ts";

export async function detectGit(pi: ExtensionAPI, cwd: string): Promise<GitInfo> {
  const hasGit = (await pi.exec("test", ["-d", ".git"], { cwd })).code === 0;
  if (!hasGit) return { hasGit: false, baseBranch: null, snapshotSha: null, currentBranch: null, featureBranch: null };

  const currentRes = await pi.exec("git", ["branch", "--show-current"], { cwd });
  const currentBranch = currentRes.code === 0 ? currentRes.stdout.trim() || null : null;

  const headRes = await pi.exec("git", ["rev-parse", "HEAD"], { cwd });
  const snapshotSha = headRes.code === 0 ? headRes.stdout.trim() || null : null;

  const baseBranch = await detectBaseBranch(pi, cwd);
  return { hasGit: true, baseBranch, snapshotSha, currentBranch, featureBranch: null };
}

async function detectBaseBranch(pi: ExtensionAPI, cwd: string): Promise<string | null> {
  const symRes = await pi.exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
  if (symRes.code === 0) {
    const m = symRes.stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (m) return m[1];
  }
  for (const candidate of ["main", "master", "trunk"]) {
    const r = await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`], { cwd });
    if (r.code === 0) return candidate;
  }
  return null;
}
