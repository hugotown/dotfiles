// Pure, deterministic quality gate for the implementation plan the plandraft node
// produces. Replaces the skill's "self-review" trust step with a real check: an
// incomplete plan is rejected and plandraft retries with the feedback. Lenient on
// wording (substance, not heading nitpicking) so good plans aren't rejected.

export function validatePlan(plan: string, contracts: unknown): string[] {
  const text = plan.trim();
  const problems: string[] = [];
  if (text.length < 500) problems.push("too short to be a complete task-by-task plan");
  // No regex placeholder gate: distinguishing a real placeholder from a mention
  // (e.g. a "Placeholder scan: no TBD/TODO" self-review line, or the project's
  // todoRouter) is not robust and produced false-negatives that escalated good
  // plans. The core instructs the model to avoid placeholders; the structural
  // checks below catch truncated/incomplete plans without false positives.
  if (!/\bgoal\b/i.test(text) || !/architecture/i.test(text)) {
    problems.push("missing the plan header (Goal / Architecture / Tech Stack)");
  }
  if (!/\btests?\b|\bcoverage\b/i.test(text)) {
    problems.push("missing TDD steps / test strategy");
  }
  if (!Array.isArray(contracts) || contracts.length === 0) {
    problems.push("missing the file-contracts JSON array (one entry per file to create/modify)");
  }
  return problems;
}
