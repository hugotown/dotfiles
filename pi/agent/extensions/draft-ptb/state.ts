export type Phase =
  | "IDLE"
  | "GATHERING_CONTEXT"
  | "RESEARCH"
  | "APPROACHES"
  | "DESIGN"
  | "PLAN"
  | "COMPLETE";

export interface Question {
  question: string;
  options?: string[];
}

export interface Answer {
  question: string;
  answer: string;
}

export interface Approach {
  name: string;
  description: string;
  tradeoffs: string;
}

export interface DraftState {
  phase: Phase;
  idea: string;
  compressedContext: string;
  questions: Question[];
  answers: Answer[];
  approaches: Approach[];
  recommendation: string;
  chosenApproach: Approach | null;
  specTitle: string;
  spec: string;
  specPath: string | null;
  revisionFeedback: string;
  plan: string;
  planPath: string | null;
  originalModel: { provider: string; id: string } | null;
  allToolNames: string[];
}

export type DraftEvent =
  | { type: "START" }
  | { type: "CONTEXT_READY"; compressedContext: string }
  | { type: "QUESTIONS_RECEIVED"; questions: Question[] }
  | { type: "ANSWERS_COLLECTED"; answers: Answer[] }
  | { type: "APPROACHES_RECEIVED"; approaches: Approach[]; recommendation: string }
  | { type: "APPROACH_CHOSEN"; approach: Approach }
  | { type: "SPEC_RECEIVED"; title: string; spec: string }
  | { type: "SPEC_APPROVED"; specPath: string }
  | { type: "SPEC_REVISION_REQUESTED"; feedback: string }
  | { type: "PLAN_RECEIVED"; plan: string }
  | { type: "PLAN_SAVED"; planPath: string }
  | { type: "RESET" };
