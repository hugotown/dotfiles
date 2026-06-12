// Step 2 — the plan phase, a code-driven node machine of isolated subagents:
//   research (Gemini-grounded) → plandraft → validate (retry loop).
// All nodes run as child pis (autonomous, invisible), so this is a simple
// SEQUENTIAL driver — no controller turns, no agent_end hooks (unlike brainstorm).
// The HARD research gate is load-bearing: an ungrounded required decision aborts.

import * as fs from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FileContract, FlowEvent, FlowState } from "../types.ts";
import { persist } from "../orchestrator.ts";
import { runChildPi } from "../lib/spawn-pi.ts";
import { loadCore } from "../lib/cores.ts";
import { rulesBlock } from "../lib/rules.ts";
import { extractJsonBlock } from "../lib/json-extract.ts";
import { planPath } from "../lib/paths.ts";
import { EXPLORE, GEMINI_RESEARCH, WRITE } from "../lib/tools.ts";
import { metricFromSpawn, type RecordMetric } from "../lib/metrics.ts";
import { repoContextBlock } from "../lib/repo-context.ts";
import { announce, working } from "../lib/progress.ts";
import { type PlanScratch, initPlanScratch } from "./plan/types.ts";
import { validatePlan } from "./plan/plan-validate.ts";
import { deriveContracts } from "./plan/contracts.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

const RESEARCH_TOOLS = [...EXPLORE, ...GEMINI_RESEARCH];
const PLAN_TOOLS = WRITE;
const MAX_PLAN_ATTEMPTS = 2;

function ps(state: FlowState): PlanScratch | undefined {
  return state.scratch.plan as PlanScratch | undefined;
}

function researchSystem(state: FlowState, repoCtx: string): string {
  return [
    loadCore("writing-plans"),
    ...(repoCtx ? ["\n---\n", repoCtx] : []),
    `## Plan — research node (HARD research gate)
- Every technical decision MUST be grounded with gemini_google_search (and gemini_libraries / gemini_deep_research_* for current library docs) against REAL examples. An ungrounded decision must be omitted.
- Extract the AS_IS from the codebase (ast-grep via bash + read); note the TO_BE.
- Produce a CONCISE research digest: each decision + its grounding (sources) + the relevant AS_IS. NO plan, NO tasks — your FINAL message IS the digest.
- If a REQUIRED decision cannot be grounded, end your final message with "STATUS: ABORT" and the reason.`,
    rulesBlock(state.config.phases.plan_research.rules),
  ].join("\n");
}

function planSystem(state: FlowState, repoCtx: string): string {
  const cov = state.config.limits.coverageThreshold;
  const s = ps(state);
  return [
    loadCore("writing-plans"),
    ...(repoCtx ? ["\n---\n", repoCtx] : []),
    `## Research digest (grounded — build the plan on THIS)\n${s?.researchDigest || "(none)"}`,
    `## Plan — plandraft node
- Write the plan as bite-sized TDD tasks with exact file paths and complete code.
- Tests: unit + integration (~90% weight) + e2e tracing ALL fields & journeys; coverage > ${cov}%.
- File contracts: 1 agent = 1 file. SOLID + DRY. Files <= 70 LOC (max 120 with comments/blanks).
- FINISH THE PLAN FILE with a "## File Contracts" section containing a \`\`\`json array
  [{"path","purpose","dependsOn":[paths]}] — one entry per file to create/modify.
  Write it INTO the plan file (not just your reply); the harness reads it from disk.`,
    ...(s?.lastRejection ? [`\n## Your previous attempt was REJECTED — fix exactly these:\n${s.lastRejection}`] : []),
    rulesBlock(state.config.phases.plan.rules),
  ].join("\n");
}

/** Node 1 — isolated, Gemini-grounded research. Returns false on ABORT/timeout. */
async function runResearch(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, record: RecordMetric): Promise<boolean> {
  announce(pi, { icon: "🔬", text: "Investigando decisiones técnicas (grounding con Gemini)…" });
  working(ctx, "🔬 Investigando decisiones técnicas (Gemini, aislado)…");
  const pm = state.config.phases.plan_research;
  const sys = researchSystem(state, repoContextBlock(ctx.cwd));
  const task = `Spec: ${state.specPath}. Read it fully, then research and output the grounded digest. STATUS: ABORT if a required decision can't be grounded.`;
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task, toolAllowlist: RESEARCH_TOOLS, cwd: ctx.cwd, timeoutMs: state.config.limits.childTimeoutMs },
    "plan-research",
  );
  record(metricFromSpawn("plan", "research", `${pm.provider}/${pm.model}`, res));
  if (res.timedOut || /STATUS:\s*ABORT/i.test(res.finalText)) return false;
  const s = ps(state);
  if (s) {
    s.researchDigest = res.finalText.trim();
    s.node = "plandraft";
  }
  persist(pi, state);
  announce(pi, { icon: "📋", text: "Research listo — redactando el plan" });
  return true;
}

/** Node 2 — isolated plan writer. Returns the final text + whether the file landed. */
async function runPlanDraft(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, record: RecordMetric, pp: string): Promise<{ ok: boolean; finalText: string }> {
  announce(pi, { icon: "📝", text: "Redactando el plan (tareas TDD + file contracts)…" });
  working(ctx, "📝 Redactando el plan (aislado)…");
  const pm = state.config.phases.plan;
  const sys = planSystem(state, repoContextBlock(ctx.cwd));
  const task = `Spec: ${state.specPath}. Write the implementation plan to ${pp} following the core and the research digest.`;
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task, toolAllowlist: PLAN_TOOLS, cwd: ctx.cwd, timeoutMs: state.config.limits.childTimeoutMs },
    "plan-draft",
  );
  record(metricFromSpawn("plan", "plandraft", `${pm.provider}/${pm.model}`, res));
  return { ok: !res.timedOut && fs.existsSync(pp), finalText: res.finalText };
}

export async function drivePlan(state: FlowState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  state.scratch.plan = initPlanScratch();
  persist(pi, state);

  if (!(await runResearch(state, pi, ctx, record))) {
    await advance(ctx, { type: "ESCALATE", reason: "Plan research aborted: a required decision could not be grounded." });
    return;
  }

  // Node 3 — deterministic validate, retrying plandraft with feedback on failure.
  const pp = planPath(ctx.cwd, state.idea);
  const s = ps(state);
  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt++) {
    if (s) s.attempts = attempt;
    const draft = await runPlanDraft(state, pi, ctx, record, pp);
    if (!draft.ok) {
      if (attempt >= MAX_PLAN_ATTEMPTS) {
        await advance(ctx, { type: "ESCALATE", reason: "Plan draft timed out or wrote no file." });
        return;
      }
      continue;
    }
    // Read contracts from the PLAN FILE (robust): the model writes the full plan —
    // incl. the "## File Contracts" json — to disk, but rarely repeats it in its
    // final message. Extracting from finalText was a false-negative on big plans.
    // Fallback: derive from the plan's Create:/Modify:/Test: lines.
    const planText = fs.readFileSync(pp, "utf-8");
    let contracts = extractJsonBlock<FileContract[]>(planText) ?? [];
    if (!Array.isArray(contracts) || contracts.length === 0) contracts = deriveContracts(planText);
    const problems = validatePlan(planText, contracts);
    if (problems.length === 0) {
      working(ctx);
      announce(pi, { icon: "✅", text: `Plan validado (${contracts.length} file contracts)` });
      await advance(ctx, { type: "PLAN_DONE", planPath: pp, fileContracts: contracts });
      return;
    }
    if (s) s.lastRejection = problems.map((p) => `- ${p}`).join("\n");
    persist(pi, state);
    announce(pi, { icon: "⚠️", text: `Plan rechazado (intento ${attempt}/${MAX_PLAN_ATTEMPTS}): ${problems.length} problema(s)` });
  }
  await advance(ctx, { type: "ESCALATE", reason: `Plan failed validation after ${MAX_PLAN_ATTEMPTS} attempts.` });
}
