// Dispatcher for the LLM_REVIEW phase.
// Three reviewer subagents run in parallel with different models per dimension.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, ReviewDimensionResult, ReviewResults } from "./state.ts";
import { runChildPi, type SpawnResult } from "./child-process.ts";
import { parseReviewVerdict } from "./review-parser.ts";
import { buildReviewContractsPrompt } from "./prompts/review-contracts.ts";
import { buildReviewQualityPrompt } from "./prompts/review-quality.ts";
import { buildReviewTestsPrompt } from "./prompts/review-tests.ts";
import { REVIEWER_TOOLS } from "./models.ts";

interface ReviewerSpec {
  dimension: "contracts" | "quality" | "tests";
  provider: string;
  model: string;
  systemPrompt: string;
  submitTool: string;
}

export async function dispatchReview(
  state: DraftState, _pi: ExtensionAPI, ctx: ExtensionContext,
): Promise<ReviewResults> {
  const specs: ReviewerSpec[] = [
    { dimension: "contracts", provider: "github-copilot", model: "claude-opus-4.6", systemPrompt: buildReviewContractsPrompt(state), submitTool: "draft_ptb_review_contracts" },
    { dimension: "quality", provider: "github-copilot", model: "gpt-5.4", systemPrompt: buildReviewQualityPrompt(state), submitTool: "draft_ptb_review_quality" },
    { dimension: "tests", provider: "github-copilot", model: "gemini-3.1-pro-preview", systemPrompt: buildReviewTestsPrompt(state), submitTool: "draft_ptb_review_tests" },
  ];

  ctx.ui.notify(`🔍 Dispatch de 3 revisores en paralelo (contracts/quality/tests)...`, "info");
  const outcomes = await Promise.all(specs.map((s) => runReviewer(s, ctx.cwd)));

  return {
    contracts: buildVerdict(specs[0], outcomes[0]),
    quality: buildVerdict(specs[1], outcomes[1]),
    tests: buildVerdict(specs[2], outcomes[2]),
  };
}

async function runReviewer(spec: ReviewerSpec, cwd: string): Promise<SpawnResult> {
  const tools = [spec.submitTool, ...REVIEWER_TOOLS];
  return runChildPi(
    {
      provider: spec.provider, model: spec.model, systemPrompt: spec.systemPrompt,
      userTask: `Review the ${spec.dimension} dimension and emit the verdict by calling \`${spec.submitTool}\`.`,
      toolAllowlist: tools, cwd, thinking: "high",
    },
    spec.dimension,
  );
}

function buildVerdict(spec: ReviewerSpec, result: SpawnResult): ReviewDimensionResult {
  if (result.exitCode !== 0) {
    return {
      approved: false,
      issues: [{
        severity: "critical", file: "(reviewer)", line: null,
        description: `${spec.dimension} reviewer process exited ${result.exitCode}: ${result.stderr.trim().slice(0, 400)}`,
        fixSuggestion: "rerun the review — the reviewer subagent failed to complete",
      }],
    };
  }
  return parseReviewVerdict(result.finalText, spec.dimension);
}
