// Step 2 — autonomous planning with a HARD Gemini research-grounding gate.
// The gemini tools are referenced by name only (no cross-extension import).

import * as fs from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FileContract, FlowEvent, FlowState } from "../types.ts";
import { runChildPi } from "../lib/spawn-pi.ts";
import { autonomousSkill } from "../lib/skill-loader.ts";
import { rulesBlock } from "../lib/rules.ts";
import { extractJsonBlock } from "../lib/json-extract.ts";
import { planPath } from "../lib/paths.ts";
import { phaseTools } from "../lib/tools.ts";
import { metricFromSpawn, type RecordMetric } from "../lib/metrics.ts";
import { repoContextBlock } from "../lib/repo-context.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function system(skillsDir: string, cov: number): string {
  return [
    autonomousSkill(skillsDir, "writing-plans"),
    `## obra-sp-flow plan gate (HARD RULES)
- RESEARCH GATE: every technical decision MUST be grounded with gemini_google_search
  (and gemini_libraries / gemini_deep_research_* for current library docs) against REAL
  implementation examples. Ungrounded decision => omit it. If a REQUIRED decision cannot
  be grounded, end your final message with STATUS: ABORT and the reason.
- Extract the AS_IS from the codebase (ast-grep/read) and plan the TO_BE.
- Migrations/seed: only re-arrange if the spec states the DB may be wiped; otherwise plan
  additive, forward-only migrations.
- Tests: unit + integration (~90% weight) + e2e tracing ALL fields & journeys; coverage > ${cov}%.
- File contracts: 1 agent = 1 file. SOLID + DRY. Files <= 70 LOC (max 120 with comments/blanks).`,
  ].join("\n\n");
}

export async function drivePlan(state: FlowState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  ctx.ui.notify("📐 Planning (writing-plans + Gemini research gate)...", "info");
  const pp = planPath(ctx.cwd, state.idea);
  const pm = state.config.phases.plan;
  const task = [
    `Spec: ${state.specPath}. Read it fully.`,
    `Write the implementation plan to ${pp} following the writing-plans skill.`,
    `End your final message with a \`\`\`json array of file contracts: [{"path","purpose","dependsOn":[paths]}].`,
    `If a required decision cannot be grounded with research, end with STATUS: ABORT and explain.`,
  ].join("\n");
  const repoCtx = repoContextBlock(ctx.cwd);
  const sys = system(state.config.skillsDir, state.config.limits.coverageThreshold) + (repoCtx ? `\n\n${repoCtx}` : "") + rulesBlock(pm.rules);
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task, toolAllowlist: phaseTools("plan", pm.tools), cwd: ctx.cwd },
    "plan",
  );
  record(metricFromSpawn("plan", "plan", `${pm.provider}/${pm.model}`, res));
  if (/STATUS:\s*ABORT/i.test(res.finalText) || !fs.existsSync(pp)) {
    await advance(ctx, { type: "ESCALATE", reason: `Plan aborted/incomplete: ${res.finalText.slice(0, 300)}` });
    return;
  }
  const contracts = extractJsonBlock<FileContract[]>(res.finalText) ?? [];
  ctx.ui.notify(`🗂️ Plan ready: ${pp} (${contracts.length} file contracts)`, "info");
  await advance(ctx, { type: "PLAN_DONE", planPath: pp, fileContracts: contracts });
}
