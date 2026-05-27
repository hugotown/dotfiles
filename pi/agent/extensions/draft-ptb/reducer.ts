import type { DraftState, DraftEvent } from "./state.ts";

export function createInitialState(idea: string): DraftState {
  return {
    phase: "IDLE",
    idea,
    compressedContext: "",
    questions: [],
    answers: [],
    approaches: [],
    recommendation: "",
    chosenApproach: null,
    specTitle: "",
    spec: "",
    specPath: null,
    revisionFeedback: "",
    plan: "",
    planPath: null,
    originalModel: null,
    allToolNames: [],
  };
}

export function transition(state: DraftState, event: DraftEvent): DraftState {
  if (event.type === "RESET") return { ...state, phase: "IDLE" };

  switch (state.phase) {
    case "IDLE":
      if (event.type === "START") return { ...state, phase: "GATHERING_CONTEXT" };
      return state;

    case "GATHERING_CONTEXT":
      if (event.type === "CONTEXT_READY")
        return { ...state, phase: "RESEARCH", compressedContext: event.compressedContext };
      return state;

    case "RESEARCH":
      if (event.type === "QUESTIONS_RECEIVED") return { ...state, questions: event.questions };
      if (event.type === "ANSWERS_COLLECTED")
        return { ...state, phase: "APPROACHES", answers: event.answers };
      return state;

    case "APPROACHES":
      if (event.type === "APPROACHES_RECEIVED")
        return { ...state, approaches: event.approaches, recommendation: event.recommendation };
      if (event.type === "APPROACH_CHOSEN")
        return { ...state, phase: "DESIGN", chosenApproach: event.approach };
      return state;

    case "DESIGN":
      if (event.type === "SPEC_RECEIVED")
        return { ...state, specTitle: event.title, spec: event.spec };
      if (event.type === "SPEC_APPROVED")
        return { ...state, phase: "PLAN", specPath: event.specPath };
      if (event.type === "SPEC_REVISION_REQUESTED")
        return { ...state, revisionFeedback: event.feedback };
      return state;

    case "PLAN":
      if (event.type === "PLAN_RECEIVED") return { ...state, plan: event.plan };
      if (event.type === "PLAN_SAVED")
        return { ...state, phase: "COMPLETE", planPath: event.planPath };
      return state;

    default:
      return state;
  }
}
