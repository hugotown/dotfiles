// Terminal phases: COMPLETE and IDLE cleanup.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "../state.ts";
import { restoreDefaults } from "../orchestrator.ts";
import { APPROACHES_WIDGET_KEY } from "../handlers.ts";
import { saveRun } from "../file-ops.ts";

export async function driveComplete(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  ctx.ui.setStatus("draft-ptb", undefined);
  ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
  await restoreDefaults(pi, ctx, state);
  const runPath = await saveRun(ctx, state).catch((e) => {
    ctx.ui.notify(`⚠️ Failed to persist run snapshot: ${(e as Error).message}`, "warning");
    return null;
  });
  const sr = state.shipResult;
  const headline = sr?.failed
    ? `⚠️ draft-ptb terminó SIN haber subido los cambios.`
    : `✅ draft-ptb complete!`;
  const summary = [
    headline,
    `  Folder: ${state.featureFolder}`,
    `  Brainstorming: ${state.brainstormingPath ?? "(none)"}`,
    `  Spec: ${state.specPath ?? "(none)"}`,
    `  Plan: ${state.planPath ?? "(none)"}`,
    sr?.prUrl ? `  PR: ${sr.prUrl}` : "",
    sr?.failed && sr.failureReason ? `  Motivo: ${sr.failureReason}` : "",
    runPath ? `  Run snapshot: ${runPath}` : "",
  ].filter(Boolean).join("\n");
  ctx.ui.notify(summary, sr?.failed ? "warning" : "info");
}

export async function driveIdle(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  ctx.ui.setStatus("draft-ptb", undefined);
  ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
  await restoreDefaults(pi, ctx, state);
}
