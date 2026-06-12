// Pure contracts for the code-driven plan node machine. No pi deps so the logic
// stays unit-testable. Lives in FlowState.scratch.plan, persisted event-sourced.
//   research (isolated child, Gemini-grounded) -> plandraft (isolated child)
//   -> validate (deterministic gate; retries plandraft on failure).

export type PlanNodeId = "research" | "plandraft" | "validate" | "done";

export interface PlanScratch {
  node: PlanNodeId;
  /** plandraft attempts so far (validate retries with feedback up to a cap). */
  attempts: number;
  /** Grounded findings from the research node, injected into plandraft. */
  researchDigest?: string;
  /** Last validation rejection, fed back to the next plandraft attempt. */
  lastRejection?: string;
}

export function initPlanScratch(): PlanScratch {
  return { node: "research", attempts: 0 };
}
