import type { DraftState } from "../state.ts";

export function buildCompletenessPrompt(state: DraftState): string {
  const qa = state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n") || "(no answers collected)";
  const u = state.understanding;
  const tr = u.testRequirements;

  return (
    `You are validating that we have ENOUGH understanding to design this feature.\n` +
    `Your ONLY job is to call draft_ptb_completeness_check with { complete, missingInfo }.\n\n` +
    `## Idea\n${state.idea}\n\n` +
    `## Understanding\n` +
    `- User story: when=${u.userStory.when} | given=${u.userStory.given} | then=${u.userStory.then}\n` +
    `- Why: ${u.why}\n- Value: ${u.value}\n` +
    `- Risks: ${u.risks.join("; ") || "(none)"}\n` +
    `- Existing solutions: ${u.existingSolutions}\n` +
    `- Reusable components: ${u.reusableComponents}\n` +
    `- Assumptions: ${u.assumptions.join("; ") || "(none)"}\n` +
    `- Non-goals: ${u.nonGoals.join("; ") || "(none)"}\n` +
    `- Scope: decomposable=${u.scopeCheck.isDecomposable}, subProjects=${u.scopeCheck.subProjects.join(", ") || "(none)"}\n` +
    `- Test requirements: wantsE2E=${tr.wantsE2E}, wantsIntegration=${tr.wantsIntegration}, ` +
    `fields=${tr.fields.length}, functionalReqs=${tr.functionalRequirements.length}, businessRules=${tr.businessRules.length}\n\n` +
    `## Q&A from user\n${qa}\n\n` +
    `## Decide\n` +
    `- complete=true if there is enough information to design and plan (do NOT require perfection).\n` +
    `- complete=false ONLY if a critical decision can't be made without more user input.\n` +
    `- missingInfo: HUMAN-readable items, each will become a new question to the user.\n\n` +
    `Iteration: ${state.completenessIterations + 1} of 3. After 3 iterations the system advances regardless.\n\n` +
    `Call draft_ptb_completeness_check now.`
  );
}
