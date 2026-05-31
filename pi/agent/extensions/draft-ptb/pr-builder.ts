// PR body, title, and commit message builders.

import type { DraftState } from "./state.ts";
import { slugify } from "./utils.ts";

export function buildCommitMessage(state: DraftState): string {
  return `feat: ${slugify(state.idea, 50)}`;
}

export function buildPrTitle(state: DraftState): string {
  return state.specTitle?.trim() || `feat: ${slugify(state.idea, 50)}`;
}

export function buildPrBody(state: DraftState): string {
  const lines: string[] = [];
  lines.push(`## Summary`, ``, state.idea, ``);
  lines.push(`## Plan`, ``);
  lines.push(`- Spec: \`${state.specPath ?? "(none)"}\``);
  lines.push(`- Plan: \`${state.planPath ?? "(none)"}\``);
  lines.push(`- Brainstorming: \`${state.brainstormingPath ?? "(none)"}\``);
  lines.push(``);
  appendImplSection(lines, state);
  appendChecksSection(lines, state);
  appendReviewSection(lines, state);
  if (state.iterationCount > 0) {
    lines.push(`## Iterations`, ``, `Review/fix loop ran ${state.iterationCount} time(s) before shipping.`, ``);
  }
  return lines.join("\n");
}

function appendImplSection(lines: string[], state: DraftState): void {
  lines.push(`## Implementation`, ``);
  lines.push(`- ${state.implementationResults.length} task(s) dispatched in parallel`);
  const blocked = state.implementationResults.filter((r) => r.status === "BLOCKED").length;
  const concerns = state.implementationResults.filter((r) => r.status === "DONE_WITH_CONCERNS").length;
  lines.push(`- ${blocked} blocked, ${concerns} done with concerns, ${state.implementationResults.length - blocked - concerns} clean`);
  if (state.testGenerationResults.length > 0) {
    const tBlocked = state.testGenerationResults.filter((r) => r.status === "BLOCKED").length;
    lines.push(`- ${state.testGenerationResults.length} test artifact(s) generated, ${tBlocked} blocked`);
  }
  lines.push(``);
}

function appendChecksSection(lines: string[], state: DraftState): void {
  if (!state.checksResult) return;
  const c = state.checksResult;
  lines.push(`## Deterministic checks`, ``);
  lines.push(`- typecheck: ${c.typecheck.passed ? "✓" : "✗"}`);
  lines.push(`- lint: ${c.lint.passed ? "✓" : "✗"}`);
  lines.push(`- tests: ${c.tests.passed ? "✓" : "✗"}`);
  if (c.workbooks.length > 0) {
    lines.push(`- workbooks: ${c.workbooks.filter((w) => w.passed).length}/${c.workbooks.length} passing`);
  }
  lines.push(``);
}

function appendReviewSection(lines: string[], state: DraftState): void {
  if (!state.reviewResults) return;
  const r = state.reviewResults;
  lines.push(`## LLM review`, ``);
  lines.push(`- contracts: ${r.contracts.approved ? "✓" : "✗"} (${r.contracts.issues.length} issues)`);
  lines.push(`- quality: ${r.quality.approved ? "✓" : "✗"} (${r.quality.issues.length} issues)`);
  lines.push(`- tests: ${r.tests.approved ? "✓" : "✗"} (${r.tests.issues.length} issues)`);
  lines.push(``);
}
