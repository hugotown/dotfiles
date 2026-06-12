// Phase router. Delegates the current phase to its focused driver and renders
// the terminal COMPLETE state (restore defaults + summary/escalation notice).

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "./types.ts";
import { restoreDefaults } from "./orchestrator.ts";
import { driveBrainstorm } from "./phases/brainstorm.ts";
import { drivePlan } from "./phases/plan.ts";
import { driveBranch } from "./phases/branch.ts";
import { driveImplement } from "./phases/implement.ts";
import { driveReview } from "./phases/review.ts";
import { driveVerify } from "./phases/verify.ts";
import { driveDebug } from "./phases/debug.ts";
import { driveFinish } from "./phases/finish.ts";
import { formatReport, type RecordMetric, restoreMetrics, writeMetricsReport } from "./lib/metrics.ts";
import { featureSlug } from "./lib/paths.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

async function driveComplete(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  await restoreDefaults(pi, ctx, state);
  const metrics = restoreMetrics(ctx);
  if (metrics.length) {
    ctx.ui.notify(formatReport(metrics), "info");
    try {
      const reportPath = writeMetricsReport(ctx.cwd, featureSlug(state.idea), metrics);
      ctx.ui.notify(`📊 Token report: ${reportPath}`, "info");
    } catch (e) {
      ctx.ui.notify(`Token report not written: ${String(e).slice(0, 160)}`, "warning");
    }
  }
  if (state.escalation) ctx.ui.notify(`⛔ obra-sp-flow escalated: ${state.escalation}`, "error");
  else ctx.ui.notify(`🎉 obra-sp-flow complete. Spec: ${state.specPath} | Plan: ${state.planPath}`, "info");
}

export async function driveCurrentPhase(
  state: FlowState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
  record: RecordMetric,
): Promise<void> {
  switch (state.phase) {
    case "BRAINSTORM": return driveBrainstorm(state, pi, ctx, advance, record);
    case "PLAN": return drivePlan(state, pi, ctx, advance, record);
    case "BRANCH": return driveBranch(state, pi, ctx, advance);
    case "IMPLEMENT": return driveImplement(state, pi, ctx, advance, record);
    case "REVIEW": return driveReview(state, pi, ctx, advance, record);
    case "VERIFY": return driveVerify(state, pi, ctx, advance);
    case "DEBUG": return driveDebug(state, pi, ctx, advance, record);
    case "FINISH": return driveFinish(state, pi, ctx, advance);
    case "COMPLETE": return driveComplete(state, pi, ctx);
    case "IDLE": return;
  }
}
