// Reducers for early phases: IDLE, GATHERING_CONTEXT, RESEARCH, COMPLETENESS_CHECK, APPROACHES.

import type { DraftState, DraftEvent } from "./state.ts";

export function reduceEarlyPhases(state: DraftState, event: DraftEvent): DraftState | null {
  switch (state.phase) {
    case "IDLE":
      if (event.type === "START") return { ...state, phase: "GATHERING_CONTEXT" };
      return state;

    case "GATHERING_CONTEXT":
      if (event.type === "PROJECT_DETECTED") {
        return { ...state, phase: "RESEARCH", projectInfo: event.projectInfo, gitInfo: event.gitInfo, compressedContext: event.tree };
      }
      return state;

    case "RESEARCH":
      if (event.type === "UNDERSTANDING_RECEIVED") return { ...state, understanding: event.understanding, questions: event.openQuestions };
      if (event.type === "ANSWERS_COLLECTED") return { ...state, phase: "COMPLETENESS_CHECK", answers: event.answers, brainstormingPath: event.brainstormingPath };
      return state;

    case "COMPLETENESS_CHECK":
      if (event.type === "COMPLETENESS_CHECKED") return { ...state, completenessResult: event.result };
      if (event.type === "COMPLETENESS_LOOP") return { ...state, phase: "RESEARCH", completenessIterations: state.completenessIterations + 1 };
      if (event.type === "COMPLETENESS_ADVANCE") return { ...state, phase: "APPROACHES" };
      return state;

    case "APPROACHES":
      if (event.type === "APPROACHES_RECEIVED") return { ...state, approaches: event.approaches, recommendation: event.recommendation };
      if (event.type === "APPROACH_CHOSEN") return { ...state, phase: "DESIGN", chosenApproach: event.approach };
      return state;

    default:
      return null; // Signal: not handled by this reducer.
  }
}
