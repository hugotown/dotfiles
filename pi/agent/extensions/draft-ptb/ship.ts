// Ship: commit + push + create PR.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, ShipResult } from "./state.ts";
import { commitAll, pushBranch, createPR, detectGhCli, isProtectedBranch } from "./git-ops.ts";
import { buildCommitMessage, buildPrTitle, buildPrBody } from "./pr-builder.ts";

export async function ship(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<ShipResult> {
  if (!state.gitInfo.hasGit) {
    ctx.ui.notify(`📦 Sin git: los cambios están aplicados. Respaldo en .draft-ptb-backup/`, "info");
    return { committed: false, pushed: false, prUrl: null, failed: false, failureReason: null };
  }

  const branch = state.gitInfo.featureBranch ?? state.gitInfo.currentBranch;
  if (!branch || isProtectedBranch(branch)) {
    ctx.ui.notify(`⛔ No se puede subir desde rama protegida "${branch ?? "(desconocida)"}".`, "error");
    return { committed: false, pushed: false, prUrl: null, failed: true, failureReason: `cannot push from protected branch: ${branch ?? "unknown"}` };
  }

  const commit = await commitAll(pi, ctx.cwd, buildCommitMessage(state));
  if (commit.reason && !commit.committed && commit.reason !== "nothing to commit") {
    ctx.ui.notify(`⚠️ commit falló: ${commit.reason}`, "warning");
  }

  const push = await pushBranch(pi, ctx.cwd, branch);
  if (!push.pushed) {
    ctx.ui.notify(`⛔ push falló: ${push.reason ?? "(sin detalle)"}`, "error");
    return { committed: commit.committed, pushed: false, prUrl: null, failed: true, failureReason: `push failed: ${push.reason ?? "unknown"}` };
  }

  const ghAvailable = await detectGhCli(pi);
  if (!ghAvailable) {
    ctx.ui.notify(`ℹ️ El CLI \`gh\` no está instalado. Rama subida; crea el PR manualmente.`, "info");
    return { committed: commit.committed, pushed: true, prUrl: null, failed: false, failureReason: null };
  }

  const baseBranch = state.gitInfo.baseBranch ?? "main";
  const pr = await createPR(pi, ctx.cwd, baseBranch, buildPrTitle(state), buildPrBody(state));
  if (!pr.url) {
    ctx.ui.notify(`⚠️ gh pr create no devolvió URL: ${pr.reason ?? "(sin detalle)"}`, "warning");
    return { committed: commit.committed, pushed: true, prUrl: null, failed: false, failureReason: null };
  }

  ctx.ui.notify(`🚀 PR creado: ${pr.url}`, "info");
  return { committed: commit.committed, pushed: true, prUrl: pr.url, failed: false, failureReason: null };
}
