import type { DraftState } from "../state.ts";

export function buildApproachesPrompt(state: DraftState): string {
  const u = state.understanding;
  const tr = u.testRequirements;
  const p = state.projectInfo;
  const qa = state.answers.length
    ? state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")
    : "(no follow-up answers)";

  const projectLine =
    `types=[${p.types.join(", ") || "unknown"}], ` +
    `monorepo=${p.isMonorepo}${p.isMonorepo ? ` (workspaces: ${p.workspaces.join(", ")})` : ""}, ` +
    `playwright=${p.hasPlaywright}, cypress=${p.hasCypress}`;

  const testsLine = tr.wantsE2E || tr.wantsIntegration
    ? `User wants tests: e2e=${tr.wantsE2E}, integration=${tr.wantsIntegration}. ` +
      `Each approach MUST be testable at those layers.`
    : `User did not ask for E2E/integration tests; do not invent test infrastructure.`;

  return (
    `You are a senior architect proposing implementation approaches.\n` +
    `Your ONLY job is to call the draft_ptb_approaches tool.\n\n` +
    `## Idea\n${state.idea}\n\n` +
    `## Understanding\n` +
    `- User story: when=${u.userStory.when} | given=${u.userStory.given} | then=${u.userStory.then}\n` +
    `- Why / value: ${u.why} / ${u.value}\n` +
    `- Risks: ${u.risks.join("; ") || "(none)"}\n` +
    `- Existing solutions: ${u.existingSolutions}\n` +
    `- Reusable components: ${u.reusableComponents}\n` +
    `- Assumptions: ${u.assumptions.join("; ") || "(none)"}\n` +
    `- Non-goals (do NOT violate): ${u.nonGoals.join("; ") || "(none)"}\n` +
    `- Scope: decomposable=${u.scopeCheck.isDecomposable}, ` +
    `subProjects=${u.scopeCheck.subProjects.join(", ") || "(none)"}\n\n` +
    `## Project\n${projectLine}\n\n` +
    `## Q&A from user\n${qa}\n\n` +
    `## Tests\n${testsLine}\n\n` +
    `## Guidelines\n` +
    `- Propose 2-3 DISTINCT approaches (not variations of the same idea)\n` +
    `- Each approach makes a different architectural trade-off\n` +
    `- Respect existing project types (${p.types.join(", ") || "n/a"}); do not propose stacks the repo cannot host\n` +
    `- Must NOT violate any item under "Non-goals"\n` +
    `- Apply YAGNI ruthlessly\n` +
    `- Lead with your recommended option and explain WHY\n` +
    `- Tradeoffs must be concrete (perf, complexity, maintenance)\n` +
    `- Prefer extending what exists over rebuilding\n` +
    `- If scope is too large, note which approach enables decomposition\n\n` +
    `Call draft_ptb_approaches now.`
  );
}
