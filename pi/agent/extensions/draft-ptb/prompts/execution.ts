import type { DraftState } from "../state.ts";

export function buildExecutionMessage(state: DraftState): string {
  return (
    `Execute the implementation plan at ${state.planPath}.\n\n` +
    `## Execution Rules\n` +
    `- Read the plan ONCE, extract all tasks with full text\n` +
    `- Execute each task sequentially using ONE subagent per task\n` +
    `- Subagents MUST use provider "github-copilot" model "claude-sonnet-4.6"\n` +
    `- Do NOT stop between tasks, ask for confirmation, or summarize progress\n` +
    `- Do NOT load or reference any skill files\n` +
    `- Provide full task text to each subagent (never make them read the plan)\n\n` +
    `## Per-Task Flow\n` +
    `1. Dispatch implementer with full task text + project context\n` +
    `2. NEEDS_CONTEXT → provide info, re-dispatch\n` +
    `3. BLOCKED → break task down or escalate\n` +
    `4. DONE → dispatch spec reviewer (matches requirements exactly?)\n` +
    `5. Spec issues → implementer fixes → re-review\n` +
    `6. Spec passes → dispatch code quality reviewer\n` +
    `7. Quality issues → implementer fixes → re-review\n` +
    `8. Both pass → next task\n\n` +
    `## Implementer Instructions (include in every prompt)\n` +
    `- TDD: failing test → verify fail → implement → verify pass → commit\n` +
    `- Self-review: completeness, quality, YAGNI, testing\n` +
    `- Report: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED\n` +
    `- If uncertain: escalate. Never guess.\n\n` +
    `## NEVER\n` +
    `- Skip reviews (spec OR quality)\n` +
    `- Proceed with unfixed issues\n` +
    `- Parallel implementation subagents\n` +
    `- Accept "close enough" on spec compliance\n` +
    `- Code quality review before spec compliance passes`
  );
}
