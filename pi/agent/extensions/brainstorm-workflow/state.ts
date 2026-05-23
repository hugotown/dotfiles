// state.ts — State interface, initial state factory, and re-exports
import type {
  Approach,
  Assumption,
  DesignSection,
  Phase,
  Question,
  ReviewResult,
} from "./types.ts";

export interface BrainstormState {
  phase: Phase;
  originalPrompt: string;
  compressedContext: string;
  assumptions: Assumption[];
  questions: Question[];
  answers: Record<string, string>;
  researchResults: string;
  approaches: Approach[];
  selectedApproach: string | null;
  design: { title: string; sections: DesignSection[] } | null;
  specPath: string | null;
  reviewResult: ReviewResult | null;
  originalModel: { provider: string; id: string } | null;
}

export function createInitialState(): BrainstormState {
  return {
    phase: "IDLE",
    originalPrompt: "",
    compressedContext: "",
    assumptions: [],
    questions: [],
    answers: {},
    researchResults: "",
    approaches: [],
    selectedApproach: null,
    design: null,
    specPath: null,
    reviewResult: null,
    originalModel: null,
  };
}

export type TransitionEvent =
  | "START"
  | "CONTEXT_GATHERED"
  | "QUESTIONS_RECEIVED"
  | "FORM_CONFIRMED"
  | "APPROACHES_RECEIVED"
  | "APPROACH_SELECTED"
  | "DESIGN_RECEIVED"
  | "DESIGN_APPROVED"
  | "SPEC_WRITTEN"
  | "REVIEW_RECEIVED"
  | "USER_APPROVED"
  | "RESET";

export interface TransitionPayloads {
  START: { prompt: string };
  CONTEXT_GATHERED: { compressedContext: string };
  QUESTIONS_RECEIVED: { assumptions: Assumption[]; questions: Question[] };
  FORM_CONFIRMED: { answers: Record<string, string>; done: boolean };
  APPROACHES_RECEIVED: { approaches: Approach[]; recommendation: string };
  APPROACH_SELECTED: { approachId: string };
  DESIGN_RECEIVED: { title: string; sections: DesignSection[] };
  DESIGN_APPROVED: Record<string, never>;
  SPEC_WRITTEN: { specPath: string };
  REVIEW_RECEIVED: { result: ReviewResult };
  USER_APPROVED: Record<string, never>;
  RESET: Record<string, never>;
}

export { transition } from "./state-transitions.ts";
