// Code-driven phases: parallel implementation, test generation, checks, review, iterate-or-ship.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "../state.ts";
import { dispatchImplementation } from "../impl-dispatcher.ts";
import { dispatchTestGeneration } from "../test-dispatcher.ts";
import { validateImports } from "../dag.ts";
import { runChecks } from "../checks/index.ts";
import { dispatchReview } from "../review-dispatcher.ts";
import { decide } from "../decision.ts";
import { ship } from "../ship.ts";
import { buildEscalationSummary } from "../escalation.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function driveParallelImpl(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🚧 implementación paralela");
  const dagErrors = validateImports(state.fileContracts, ctx.cwd);
  if (dagErrors.length > 0) ctx.ui.notify(`⚠️ Imports no resueltos:\n${dagErrors.join("\n")}`, "warning");
  const results = await dispatchImplementation(state, pi, ctx);
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const concerns = results.filter((r) => r.status === "DONE_WITH_CONCERNS").length;
  ctx.ui.notify(`✅ Implementación: ${results.length} tareas (BLOCKED=${blocked}, con observaciones=${concerns}).`, blocked > 0 ? "warning" : "info");
  await advance(ctx, { type: "IMPLEMENTATION_DONE", results });
}

export async function driveTestGen(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🧪 generación de tests");
  const results = await dispatchTestGeneration(state, pi, ctx);
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  ctx.ui.notify(`🧪 Tests: ${results.length} archivos (BLOCKED=${blocked}).`, blocked > 0 ? "warning" : "info");
  await advance(ctx, { type: "TEST_GENERATION_DONE", results });
}

export async function driveChecks(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🔎 checks deterministas");
  const result = await runChecks(state, pi, ctx);
  const failedWb = result.workbooks.filter((w) => !w.passed).length;
  const summary = `typecheck=${result.typecheck.passed ? "✓" : "✗"} lint=${result.lint.passed ? "✓" : "✗"} tests=${result.tests.passed ? "✓" : "✗"} workbooks=${result.workbooks.length - failedWb}/${result.workbooks.length} ok`;
  ctx.ui.notify(`🔎 Checks: ${summary}`, failedWb > 0 ? "warning" : "info");
  await advance(ctx, { type: "CHECKS_RAN", result });
}

export async function driveReview(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "🔍 revisión LLM");
  const result = await dispatchReview(state, pi, ctx);
  const approved = result.contracts.approved && result.quality.approved && result.tests.approved;
  const line = `contracts=${result.contracts.issues.length}, quality=${result.quality.issues.length}, tests=${result.tests.issues.length}`;
  ctx.ui.notify(`🔍 Revisión: ${approved ? "aprobada" : "con observaciones"} (${line}).`, approved ? "info" : "warning");
  await advance(ctx, { type: "REVIEW_RAN", result });
}

export async function driveIterateOrShip(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance): Promise<void> {
  ctx.ui.setStatus("draft-ptb", "⚖️ decidir: shipping o iterar");
  const decision = decide(state);
  if (decision.kind === "ship") {
    await advance(ctx, { type: "SHIPPED", result: await ship(state, pi, ctx) });
  } else if (decision.kind === "iterate") {
    ctx.ui.notify(`🔁 Iteración ${state.iterationCount + 1}/3 — re-implementando (${decision.targets.length} archivos).`, "info");
    await advance(ctx, { type: "ITERATION_NEEDED", targets: decision.targets, reason: decision.reason });
  } else {
    ctx.ui.notify(buildEscalationSummary(state), "error");
    await advance(ctx, { type: "SHIPPED", result: { committed: false, pushed: false, prUrl: null, failed: true, failureReason: decision.reason } });
  }
}
