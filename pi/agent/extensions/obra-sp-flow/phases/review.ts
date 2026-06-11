// Step 5 — consolidated code review + fix (requesting + receiving fused).
// One high-tier subagent reviews the whole diff and applies fixes with rigor.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState, ReviewIssue } from "../types.ts";
import { runChildPi } from "../lib/spawn-pi.ts";
import { autonomousSkill } from "../lib/skill-loader.ts";
import { rulesBlock } from "../lib/rules.ts";
import { extractJsonBlock } from "../lib/json-extract.ts";
import { baseSha, headSha } from "../lib/git.ts";
import { phaseTools } from "../lib/tools.ts";
import { metricFromSpawn, type RecordMetric } from "../lib/metrics.ts";
import { repoContextBlock } from "../lib/repo-context.ts";

type Advance = (ctx: ExtensionContext, event: FlowEvent) => Promise<void>;

function system(skillsDir: string): string {
  return [
    autonomousSkill(skillsDir, "requesting-code-review"),
    autonomousSkill(skillsDir, "receiving-code-review"),
    `## obra-sp-flow reviewer + fixer
- Review the diff against the spec/plan. Classify issues: critical | important | minor.
- Apply fixes for critical + important with technical rigor. You MAY reject invalid
  feedback (YAGNI / incorrect / breaks behavior) with explicit reasoning. Commit fixes.
- End your final message with a \`\`\`json array of REMAINING issues:
  [{"severity","file","description"}].`,
  ].join("\n\n");
}

export async function driveReview(state: FlowState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance, record: RecordMetric): Promise<void> {
  const pm = state.config.phases.review;
  ctx.ui.notify(`🔎 Code review + fix (${pm.provider}/${pm.model})...`, "info");
  const range = state.hasGit ? `the diff ${baseSha(ctx.cwd, state.baseBranch)}..${headSha(ctx.cwd)}` : "the current working tree";
  const task = [
    `Spec: ${state.specPath}`,
    `Plan: ${state.planPath}`,
    `Review ${range}. Fix critical + important issues and commit.`,
    `End with a \`\`\`json array of REMAINING issues.`,
  ].join("\n");
  const repoCtx = repoContextBlock(ctx.cwd);
  const sys = system(state.config.skillsDir) + (repoCtx ? `\n\n${repoCtx}` : "") + rulesBlock(pm.rules);
  const res = await runChildPi(
    { provider: pm.provider, model: pm.model, thinking: pm.thinking, systemPrompt: sys, userTask: task, toolAllowlist: phaseTools("review", pm.tools), cwd: ctx.cwd },
    "review",
  );
  record(metricFromSpawn("review", "review", `${pm.provider}/${pm.model}`, res));
  const issues = extractJsonBlock<ReviewIssue[]>(res.finalText) ?? [];
  const blocking = issues.filter((i) => i.severity !== "minor").length;
  ctx.ui.notify(`Review: ${issues.length} remaining (${blocking} blocking)`, blocking ? "warning" : "info");
  await advance(ctx, { type: "REVIEW_DONE", issues });
}
