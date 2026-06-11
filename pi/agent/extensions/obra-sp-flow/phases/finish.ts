// Step 8 — finishing the branch. Configurable action (pr|merge|keep), never
// interactive. Honors AGENTS.md guards: no force-push, no merge to protected.

import { execFileSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { git, isProtected, pushBranch } from "../lib/git.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function createPr(cwd: string, state: FlowState): string {
  const title = `${state.config.branch.prefix}: ${state.idea}`.slice(0, 72);
  const body =
    `## Summary\n\nAutomated by /obra-sp-flow.\n\n` +
    `Spec: ${state.specPath}\nPlan: ${state.planPath}\n\n` +
    `## Test Plan\n- [ ] typecheck / lint / tests green, coverage >= ${state.config.limits.coverageThreshold}%`;
  try {
    const out = execFileSync("gh", ["pr", "create", "--title", title, "--body", body, "--base", state.baseBranch], {
      cwd,
      encoding: "utf-8",
    });
    return `🔀 PR: ${out.trim()}`;
  } catch (e: any) {
    return `Branch pushed; PR not created (gh missing/failed): ${String(e?.stderr ?? e).slice(0, 200)}`;
  }
}

export async function driveFinish(
  state: FlowState,
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  const branch = state.featureBranch;
  const done = () => advance(ctx, { type: "FINISHED" });
  if (!state.hasGit || !branch) {
    ctx.ui.notify("Finish: no branch to integrate; work left in place.", "warning");
    return done();
  }
  const action = state.config.finish.action;
  if (action === "keep") {
    ctx.ui.notify(`Branch ${branch} kept as-is.`, "info");
    return done();
  }
  if (action === "merge") {
    if (isProtected(state.baseBranch)) {
      ctx.ui.notify(`Refusing to merge into protected ${state.baseBranch}; keeping branch.`, "warning");
      return done();
    }
    const co = git(ctx.cwd, `checkout ${state.baseBranch}`);
    const mg = co.ok ? git(ctx.cwd, `merge --no-ff ${branch}`) : co;
    ctx.ui.notify(mg.ok ? `Merged ${branch} → ${state.baseBranch}.` : `Merge failed: ${mg.out}`, mg.ok ? "info" : "error");
    return done();
  }
  const pushed = pushBranch(ctx.cwd, branch);
  if (!pushed.ok) {
    ctx.ui.notify(`Push failed: ${pushed.out}`, "error");
    return done();
  }
  ctx.ui.notify(createPr(ctx.cwd, state), "info");
  return done();
}
