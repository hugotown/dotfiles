import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { applyPhaseConfig, sendPhasePrompt, restoreDefaults } from "./orchestrator.ts";
import { detectProject, buildProjectTree, hasGraphify } from "./context-builder.ts";
import { buildResearchPrompt } from "./prompts/research.ts";
import { buildCompletenessPrompt } from "./prompts/completeness.ts";
import { buildApproachesPrompt } from "./prompts/approaches.ts";
import { buildDesignPrompt } from "./prompts/design.ts";
import { buildPlanPrompt } from "./prompts/plan.ts";
import { APPROACHES_WIDGET_KEY } from "./handlers.ts";
import { saveRun } from "./file-ops.ts";
import { dispatchImplementation, dispatchTestGeneration } from "./parallel-dispatcher.ts";
import { validateImports } from "./dag.ts";
import { runChecks } from "./deterministic-checks.ts";
import { dispatchReview } from "./review-dispatcher.ts";
import { decide, ship, buildEscalationSummary } from "./iterate-or-ship.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function driveCurrentPhase(
  state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "GATHERING_CONTEXT": {
      ctx.ui.setStatus("draft-ptb", "📦 detectando proyecto...");
      const { projectInfo, gitInfo } = await detectProject(pi, ctx.cwd, state.featureFolder);
      const tree = await buildProjectTree(pi, ctx.cwd);
      await advance(ctx, { type: "PROJECT_DETECTED", projectInfo, gitInfo, tree });
      break;
    }
    case "RESEARCH": {
      ctx.ui.setStatus("draft-ptb", "🔬 research");
      if (!await applyPhaseConfig(pi, ctx, "RESEARCH")) { await advance(ctx, { type: "RESET" }); return; }
      const graphify = await hasGraphify(pi, ctx.cwd);
      sendPhasePrompt(pi, buildResearchPrompt(state, graphify));
      break;
    }
    case "COMPLETENESS_CHECK": {
      ctx.ui.setStatus("draft-ptb", "✅ completeness check");
      if (!await applyPhaseConfig(pi, ctx, "COMPLETENESS_CHECK")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildCompletenessPrompt(state));
      break;
    }
    case "APPROACHES": {
      ctx.ui.setStatus("draft-ptb", "🎯 approaches");
      if (!await applyPhaseConfig(pi, ctx, "APPROACHES")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildApproachesPrompt(state));
      break;
    }
    case "DESIGN": {
      ctx.ui.setStatus("draft-ptb", "✏️ design");
      ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
      if (!await applyPhaseConfig(pi, ctx, "DESIGN")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildDesignPrompt(state));
      break;
    }
    case "PLAN": {
      ctx.ui.setStatus("draft-ptb", "📋 plan");
      if (!await applyPhaseConfig(pi, ctx, "PLAN")) { await advance(ctx, { type: "RESET" }); return; }
      sendPhasePrompt(pi, buildPlanPrompt(state));
      break;
    }
    case "PARALLEL_IMPLEMENTATION": {
      ctx.ui.setStatus("draft-ptb", "🚧 implementación paralela");
      const dagErrors = validateImports(state.fileContracts, ctx.cwd);
      if (dagErrors.length > 0) {
        ctx.ui.notify(
          `⚠️ Imports no resueltos en el grafo (puede causar errores que se corrigen por iteración):\n${dagErrors.join("\n")}`,
          "warning",
        );
      }
      const results = await dispatchImplementation(state, pi, ctx);
      const blocked = results.filter((r) => r.status === "BLOCKED").length;
      const concerns = results.filter((r) => r.status === "DONE_WITH_CONCERNS").length;
      ctx.ui.notify(
        `✅ Implementación: ${results.length} tareas (BLOCKED=${blocked}, con observaciones=${concerns}).`,
        blocked > 0 ? "warning" : "info",
      );
      await advance(ctx, { type: "IMPLEMENTATION_DONE", results });
      break;
    }
    case "TEST_GENERATION": {
      ctx.ui.setStatus("draft-ptb", "🧪 generación de tests");
      const results = await dispatchTestGeneration(state, pi, ctx);
      const blocked = results.filter((r) => r.status === "BLOCKED").length;
      ctx.ui.notify(`🧪 Tests: ${results.length} archivos (BLOCKED=${blocked}).`, blocked > 0 ? "warning" : "info");
      await advance(ctx, { type: "TEST_GENERATION_DONE", results });
      break;
    }
    case "DETERMINISTIC_CHECKS": {
      ctx.ui.setStatus("draft-ptb", "🔎 checks deterministas");
      const result = await runChecks(state, pi, ctx);
      const failedWorkbooks = result.workbooks.filter((w) => !w.passed).length;
      const summary =
        `typecheck=${result.typecheck.passed ? "✓" : "✗"} ` +
        `lint=${result.lint.passed ? "✓" : "✗"} ` +
        `tests=${result.tests.passed ? "✓" : "✗"} ` +
        `workbooks=${result.workbooks.length - failedWorkbooks}/${result.workbooks.length} ok`;
      ctx.ui.notify(`🔎 Checks: ${summary}`, failedWorkbooks > 0 ? "warning" : "info");
      await advance(ctx, { type: "CHECKS_RAN", result });
      break;
    }
    case "LLM_REVIEW": {
      ctx.ui.setStatus("draft-ptb", "🔍 revisión LLM");
      const result = await dispatchReview(state, pi, ctx);
      const approved =
        result.contracts.approved && result.quality.approved && result.tests.approved;
      const issuesLine =
        `contracts=${result.contracts.issues.length}, ` +
        `quality=${result.quality.issues.length}, ` +
        `tests=${result.tests.issues.length}`;
      ctx.ui.notify(
        `🔍 Revisión: ${approved ? "aprobada" : "con observaciones"} (${issuesLine}).`,
        approved ? "info" : "warning",
      );
      await advance(ctx, { type: "REVIEW_RAN", result });
      break;
    }
    case "ITERATE_OR_SHIP": {
      ctx.ui.setStatus("draft-ptb", "⚖️ decidir: shipping o iterar");
      const decision = decide(state);
      if (decision.kind === "ship") {
        const shipResult = await ship(state, pi, ctx);
        await advance(ctx, { type: "SHIPPED", result: shipResult });
      } else if (decision.kind === "iterate") {
        ctx.ui.notify(
          `🔁 Iteración ${state.iterationCount + 1}/3 — re-implementando archivos afectados (${decision.targets.length}).`,
          "info",
        );
        await advance(ctx, {
          type: "ITERATION_NEEDED",
          targets: decision.targets,
          reason: decision.reason,
        });
      } else {
        // escalate: notify with full history and stop (mark ship as failed).
        ctx.ui.notify(buildEscalationSummary(state), "error");
        const failedShip = {
          committed: false,
          pushed: false,
          prUrl: null,
          failed: true,
          failureReason: decision.reason,
        };
        await advance(ctx, { type: "SHIPPED", result: failedShip });
      }
      break;
    }
    case "COMPLETE": {
      ctx.ui.setStatus("draft-ptb", undefined);
      ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
      await restoreDefaults(pi, ctx, state);
      const runPath = await saveRun(ctx, state).catch((e) => {
        ctx.ui.notify(`⚠️ Failed to persist run snapshot: ${(e as Error).message}`, "warning");
        return null;
      });
      const sr = state.shipResult;
      const headline = sr?.failed
        ? `⚠️ draft-ptb terminó SIN haber subido los cambios (revisión/iteración no convergió).`
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
      break;
    }
    case "IDLE": {
      ctx.ui.setStatus("draft-ptb", undefined);
      ctx.ui.setWidget(APPROACHES_WIDGET_KEY, undefined);
      await restoreDefaults(pi, ctx, state);
      break;
    }
  }
}
