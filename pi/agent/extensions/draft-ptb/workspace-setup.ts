// Workspace preparation: branch creation, file backup, and git snapshot helpers.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "./state.ts";
import { slugify } from "./utils.ts";

export async function snapshotChangedPaths(pi: ExtensionAPI, cwd: string): Promise<Set<string>> {
  const [diff, untracked] = await Promise.all([
    workingDiffPaths(pi, cwd),
    workingUntrackedPaths(pi, cwd),
  ]);
  return new Set([...diff, ...untracked]);
}

export function diffSets(before: Set<string>, after: Set<string>): string[] {
  const out: string[] = [];
  for (const p of after) if (!before.has(p)) out.push(p);
  return out;
}

export async function prepareWorkspace(pi: ExtensionAPI, cwd: string, state: DraftState, ctx: ExtensionContext): Promise<void> {
  if (state.gitInfo.hasGit) {
    await prepareGitBranch(pi, cwd, state, ctx);
  } else {
    await fs.promises.mkdir(path.join(cwd, ".draft-ptb-backup"), { recursive: true });
  }
}

export async function backupFile(cwd: string, relPath: string): Promise<void> {
  const src = path.join(cwd, relPath);
  if (!fs.existsSync(src)) return;
  const dst = path.join(cwd, ".draft-ptb-backup", relPath);
  if (fs.existsSync(dst)) return;
  await fs.promises.mkdir(path.dirname(dst), { recursive: true });
  try { await fs.promises.copyFile(src, dst); } catch { /* ignore */ }
}

async function prepareGitBranch(pi: ExtensionAPI, cwd: string, state: DraftState, ctx: ExtensionContext): Promise<void> {
  const target = `feat/${slugify(state.idea, 40)}`;
  const current = state.gitInfo.currentBranch;
  if (!current || !(current === state.gitInfo.baseBranch || ["main", "master", "trunk"].includes(current))) return;
  const exists = (await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${target}`], { cwd })).code === 0;
  const args = exists ? ["checkout", target] : ["checkout", "-b", target];
  const r = await pi.exec("git", args, { cwd });
  if (r.code !== 0) {
    ctx.ui.notify(`⚠️ No se pudo crear/cambiar a la rama ${target}: ${r.stderr.trim()}`, "warning");
  } else {
    ctx.ui.notify(`🌿 Trabajando en la rama ${target}`, "info");
  }
}

async function workingDiffPaths(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const r = await pi.exec("git", ["diff", "--name-only", "HEAD"], { cwd });
  if (r.code !== 0) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function workingUntrackedPaths(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const r = await pi.exec("git", ["ls-files", "--others", "--exclude-standard"], { cwd });
  if (r.code !== 0) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}
