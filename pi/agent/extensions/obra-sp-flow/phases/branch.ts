// Step 3 — deterministic isolation. Cuts a standard branch (never a worktree)
// from the current branch. Tolerates non-git workspaces.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { branchExists, checkoutBranch, createBranch, currentBranch, hasGit } from "../lib/git.ts";
import { featureSlug } from "../lib/paths.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

export async function driveBranch(
  state: FlowState,
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  if (!hasGit(ctx.cwd)) {
    ctx.ui.notify("No git repo — implementing in place (no branch).", "warning");
    await advance(ctx, { type: "BRANCH_READY", featureBranch: null, baseBranch: state.baseBranch, hasGit: false });
    return;
  }
  const name = `${state.config.branch.prefix}/${featureSlug(state.idea)}`;
  const onName = currentBranch(ctx.cwd) === name;
  const base = onName ? state.baseBranch : currentBranch(ctx.cwd) || state.baseBranch;
  // Idempotent: reuse the branch if it already exists (safe for resume re-drive).
  const result = onName ? { ok: true, out: "" } : branchExists(ctx.cwd, name) ? checkoutBranch(ctx.cwd, name) : createBranch(ctx.cwd, name);
  if (!result.ok) {
    ctx.ui.notify(`Branch setup failed: ${result.out}`, "error");
    await advance(ctx, { type: "BRANCH_READY", featureBranch: null, baseBranch: base, hasGit: true });
    return;
  }
  ctx.ui.notify(`🌿 Branch ${name} (base ${base})`, "info");
  await advance(ctx, { type: "BRANCH_READY", featureBranch: name, baseBranch: base, hasGit: true });
}
