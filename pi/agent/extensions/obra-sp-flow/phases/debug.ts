// Step 7 — systematic-debugging circuit. Per distinct error: up to N sub-cycles;
// a global cap guards against ping-pong. Each sub-cycle is a full root-cause pass.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "../types.ts";
import { runChildPi } from "../lib/spawn-pi.ts";
import { autonomousSkill } from "../lib/skill-loader.ts";
import { rulesBlock } from "../lib/rules.ts";
import { phaseTools } from "../lib/tools.ts";
import { metricFromSpawn, type RecordMetric } from "../lib/metrics.ts";
import { repoContextBlock } from "../lib/repo-context.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function evidence(state: FlowState): string {
  return (state.checksResult?.results ?? [])
    .filter((r) => !r.passed)
    .map((r) => `### ${r.name}\n${r.output}`)
    .join("\n\n")
    .slice(-6000);
}

export async function driveDebug(state: FlowState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  const lim = state.config.limits;
  const errorKey = state.checksResult?.failures[0] ?? "unknown";
  const perError = (state.debugBudgets[errorKey] ?? 0) + 1;
  const global = state.debugGlobal + 1;

  if (global > lim.debugGlobalCap) {
    await advance(ctx, { type: "ESCALATE", reason: `Global debug cap (${lim.debugGlobalCap}) exceeded. Last error: ${errorKey}` });
    return;
  }
  if (perError > lim.debugSubcyclesPerError) {
    await advance(ctx, { type: "ESCALATE", reason: `Error '${errorKey}' unresolved after ${lim.debugSubcyclesPerError} cycles.` });
    return;
  }

  ctx.ui.notify(`🐛 Debug ${perError}/${lim.debugSubcyclesPerError} (global ${global}/${lim.debugGlobalCap}) — ${errorKey}`, "info");
  const pm = state.config.phases.debug;
  const arch = perError >= lim.questionArchitectureThreshold
    ? "You have failed >= 3 times: QUESTION THE ARCHITECTURE/plan, not just the symptom."
    : "";
  const task = [
    `Verification failed:\n${evidence(state)}`,
    `Find the ROOT CAUSE (no symptom patches). Write a failing test reproducing it, fix the`,
    `root cause, then commit. ${arch}`,
  ].join("\n");
  const repoCtx = repoContextBlock(ctx.cwd);
  const sys = autonomousSkill(state.config.skillsDir, "systematic-debugging") + (repoCtx ? `\n\n${repoCtx}` : "") + rulesBlock(pm.rules);
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task, toolAllowlist: phaseTools("debug", pm.tools), cwd: ctx.cwd },
    "debug",
  );
  record(metricFromSpawn("debug", `debug-${errorKey}`.slice(0, 60), `${pm.provider}/${pm.model}`, res));
  const budgets = { ...state.debugBudgets, [errorKey]: perError };
  await advance(ctx, { type: "DEBUG_DONE", budgets, globalCount: global });
}
