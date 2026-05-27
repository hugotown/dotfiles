import type { DraftState } from "../state.ts";

export function buildApproachesPrompt(state: DraftState): string {
  const qa = state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");

  return (
    `You are a senior architect proposing implementation approaches.\n` +
    `Your ONLY job is to call the draft_ptb_approaches tool.\n\n` +
    `## Idea\n${state.idea}\n\n` +
    `## Research Results\n${qa}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n` +
    `## Guidelines\n` +
    `- Propose 2-3 DISTINCT approaches (not variations of the same idea)\n` +
    `- Each approach should make a different architectural trade-off\n` +
    `- Apply YAGNI ruthlessly — remove unnecessary complexity\n` +
    `- Lead with your recommended option and explain WHY\n` +
    `- Tradeoffs must be concrete (perf, complexity cost, maintenance)\n` +
    `- Prefer extending what exists over rebuilding\n` +
    `- If scope is too large, note which approach enables decomposition\n\n` +
    `Call draft_ptb_approaches now.`
  );
}
