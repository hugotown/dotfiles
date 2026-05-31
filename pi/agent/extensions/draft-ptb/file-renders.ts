// Render functions for brainstorming and run snapshot documents.

import type { DraftState } from "./state.ts";

export function renderBrainstorming(state: DraftState): string {
  const qa = state.answers
    .map((a, i) => `### Q${i + 1}: ${a.question}\n\n${a.answer}`)
    .join("\n\n");

  return `# Brainstorming

**Idea:** ${state.idea}

**Started at:** ${state.startedAt}

## Project Context (compressed)

${state.compressedContext || "_(not gathered)_"}

## Clarifying Questions

${qa || "_(no answers)_"}
`;
}

export function renderRunJson(state: DraftState): string {
  const snapshot = {
    phase: state.phase,
    idea: state.idea,
    featureFolder: state.featureFolder,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    questions: state.questions,
    answers: state.answers,
    approaches: state.approaches,
    recommendation: state.recommendation,
    chosenApproach: state.chosenApproach,
    specTitle: state.specTitle,
    specPath: state.specPath,
    planPath: state.planPath,
    brainstormingPath: state.brainstormingPath,
  };
  return JSON.stringify(snapshot, null, 2);
}
