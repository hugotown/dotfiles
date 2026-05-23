// state-transitions.ts — Pure transition reducer for the brainstorm state machine
import type { BrainstormState, TransitionEvent, TransitionPayloads } from "./state.ts";
import { createInitialState } from "./state.ts";

export function transition<E extends TransitionEvent>(
  state: BrainstormState,
  event: E,
  payload?: TransitionPayloads[E],
): BrainstormState {
  switch (event) {
    case "START": {
      if (state.phase !== "IDLE") return state;
      const p = payload as TransitionPayloads["START"];
      return { ...state, phase: "GATHERING_CONTEXT", originalPrompt: p.prompt };
    }
    case "CONTEXT_GATHERED": {
      if (state.phase !== "GATHERING_CONTEXT") return state;
      const p = payload as TransitionPayloads["CONTEXT_GATHERED"];
      return { ...state, phase: "RESEARCHING_AND_QUESTIONING", compressedContext: p.compressedContext };
    }
    case "QUESTIONS_RECEIVED": {
      if (state.phase !== "RESEARCHING_AND_QUESTIONING") return state;
      const p = payload as TransitionPayloads["QUESTIONS_RECEIVED"];
      return { ...state, phase: "FORM_INTERACTION", assumptions: p.assumptions, questions: p.questions };
    }
    case "FORM_CONFIRMED": {
      if (state.phase !== "FORM_INTERACTION") return state;
      const p = payload as TransitionPayloads["FORM_CONFIRMED"];
      if (p.done) return { ...state, phase: "PROPOSING_APPROACHES", answers: p.answers };
      return { ...state, phase: "RESEARCHING_AND_QUESTIONING", answers: p.answers };
    }
    case "APPROACHES_RECEIVED": {
      if (state.phase !== "PROPOSING_APPROACHES") return state;
      const p = payload as TransitionPayloads["APPROACHES_RECEIVED"];
      return { ...state, phase: "APPROACH_SELECTION", approaches: p.approaches };
    }
    case "APPROACH_SELECTED": {
      if (state.phase !== "APPROACH_SELECTION") return state;
      const p = payload as TransitionPayloads["APPROACH_SELECTED"];
      return { ...state, phase: "GENERATING_DESIGN", selectedApproach: p.approachId };
    }
    case "DESIGN_RECEIVED": {
      if (state.phase !== "GENERATING_DESIGN") return state;
      const p = payload as TransitionPayloads["DESIGN_RECEIVED"];
      return { ...state, phase: "DESIGN_REVIEW", design: { title: p.title, sections: p.sections } };
    }
    case "DESIGN_APPROVED": {
      if (state.phase !== "DESIGN_REVIEW") return state;
      return { ...state, phase: "WRITING_SPEC" };
    }
    case "SPEC_WRITTEN": {
      if (state.phase !== "WRITING_SPEC") return state;
      const p = payload as TransitionPayloads["SPEC_WRITTEN"];
      return { ...state, phase: "SELF_REVIEW", specPath: p.specPath };
    }
    case "REVIEW_RECEIVED": {
      if (state.phase !== "SELF_REVIEW") return state;
      const p = payload as TransitionPayloads["REVIEW_RECEIVED"];
      if (p.result.status === "pass") return { ...state, phase: "USER_REVIEW", reviewResult: p.result };
      return { ...state, reviewResult: p.result };
    }
    case "USER_APPROVED": {
      if (state.phase !== "USER_REVIEW") return state;
      return { ...state, phase: "COMPLETE" };
    }
    case "RESET":
      return createInitialState();
    default:
      return state;
  }
}
