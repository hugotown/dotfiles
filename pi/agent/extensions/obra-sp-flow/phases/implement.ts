// Step 4 — parallel implementation by file contracts (1 agent = 1 file).
// DAG levels run in sequence; files within a level run concurrently. A BLOCKED
// file is retried once with the stronger implement_escalate model, and every
// result is verified against disk (no "DONE" without a written file).

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FileContract, FlowEvent, FlowState, ImplResult, ImplStatus, PhaseModel } from "../types.ts";
import { buildLevels } from "../lib/dag.ts";
import { mapPool } from "../lib/pool.ts";
import { runChildPi } from "../lib/spawn-pi.ts";
import { autonomousSkill } from "../lib/skill-loader.ts";
import { rulesBlock } from "../lib/rules.ts";
import { extractStatus } from "../lib/json-extract.ts";
import { lastCommitForFile } from "../lib/git.ts";
import { phaseTools } from "../lib/tools.ts";
import { metricFromSpawn, type RecordMetric } from "../lib/metrics.ts";
import { repoContextBlock } from "../lib/repo-context.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function system(skillsDir: string): string {
  return [
    autonomousSkill(skillsDir, "test-driven-development"),
    `## obra-sp-flow implementer
- You OWN exactly ONE file plus its test. NEVER create or edit any other file.
- Files you depend on WILL exist by contract; import them by their agreed path/signature
  without verifying their existence now.
- TDD: failing test first, minimal code, refactor, commit when green.
- SOLID + DRY. File <= 70 LOC (max 120 with comments/blanks).
- Final line MUST be: STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`,
  ].join("\n\n");
}

function task(c: FileContract, all: string[], state: FlowState): string {
  return [
    `Spec: ${state.specPath}`,
    `Plan: ${state.planPath}`,
    `Implement ONLY this file: ${c.path}`,
    `Purpose: ${c.purpose}`,
    `Depends on (assume they exist by contract): ${c.dependsOn.join(", ") || "none"}`,
    `FORBIDDEN files (never touch): ${all.filter((p) => p !== c.path).join(", ") || "none"}`,
    `Ground in the codebase with ast-grep/read. Commit when tests are green.`,
  ].join("\n");
}

async function spawn(pm: PhaseModel, sys: string, tools: string[], c: FileContract, all: string[], state: FlowState, cwd: string, tag: string, phaseLabel: string, record: RecordMetric): Promise<{ status: ImplStatus; notes: string }> {
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task(c, all, state), toolAllowlist: tools, cwd },
    tag,
  );
  record(metricFromSpawn(phaseLabel, tag, `${pm.provider}/${pm.model}`, res));
  const status = (res.exitCode === 0 ? extractStatus(res.finalText) : "BLOCKED") as ImplStatus;
  return { status, notes: res.finalText.slice(-300) };
}

async function implOne(c: FileContract, all: string[], state: FlowState, sys: string, cwd: string, record: RecordMetric): Promise<ImplResult> {
  const impl = state.config.phases.implement;
  let r = await spawn(impl, sys, phaseTools("implement", impl.tools), c, all, state, cwd, `impl-${c.path}`, "implement", record);
  if (r.status === "BLOCKED") {
    const esc = state.config.phases.implement_escalate;
    const escSys = `${sys}\n\n## Escalation\nA previous attempt was BLOCKED. You are a stronger model — find and resolve the root blocker.`;
    r = await spawn(esc, escSys, phaseTools("implement_escalate", esc.tools), c, all, state, cwd, `impl-esc-${c.path}`, "implement_escalate", record);
  }
  let { status, notes } = r;
  if (!fs.existsSync(path.join(cwd, c.path))) {
    status = "BLOCKED";
    notes = `No file written to disk. ${notes}`;
  }
  const commit = state.hasGit ? lastCommitForFile(cwd, c.path) || null : null;
  return { path: c.path, status, commit, notes };
}

export async function driveImplement(state: FlowState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  ctx.ui.notify(`🛠️ Implementing ${state.fileContracts.length} files (parallel by DAG)...`, "info");
  const repoCtx = repoContextBlock(ctx.cwd);
  const sys = system(state.config.skillsDir) + (repoCtx ? `\n\n${repoCtx}` : "") + rulesBlock(state.config.phases.implement.rules);
  const all = state.fileContracts.map((c) => c.path);
  const results: ImplResult[] = [];
  for (const level of buildLevels(state.fileContracts)) {
    const batch = await mapPool(level, state.config.limits.implConcurrency, (c) => implOne(c, all, state, sys, ctx.cwd, record));
    results.push(...batch);
  }
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  ctx.ui.notify(`Implemented ${results.length} files (${blocked} blocked)`, blocked ? "warning" : "info");
  await advance(ctx, { type: "IMPLEMENT_DONE", results });
}
