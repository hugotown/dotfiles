// Pure contracts for the code-driven brainstorm node machine. No pi/runtime deps,
// so the reducer-style logic stays unit-testable. This state lives in
// FlowState.scratch.brainstorm and is persisted event-sourced on every transition.

export type BrainstormNodeId = "grounding" | "questions" | "stories" | "approaches" | "spec" | "done";

export interface LedgerEntry {
  q: string;
  a: string;
}

export interface LedgerAssumption {
  text: string;
  confidence: "high" | "medium" | "low";
}

/** Compact working memory carried across question rounds. The ledger is the ONLY
 *  thing re-injected each round (see compress.ts) — never the verbose tool calls,
 *  which is what keeps the context flat and the token cost low. */
export interface BrainstormScratch {
  node: BrainstormNodeId;
  rounds: number;
  questionsDone: boolean;
  ledger: LedgerEntry[];
  assumptions: LedgerAssumption[];
  /** Concise codebase summary produced by the isolated grounding subagent; the
   *  questions node relies on this instead of exploring in the controller. */
  repoUnderstanding?: string;
  approach?: string;
  /** User stories in Given/When/Then format produced by the stories node. */
  userStories?: string;
}

export function initBrainstormScratch(): BrainstormScratch {
  return { node: "grounding", rounds: 0, questionsDone: false, ledger: [], assumptions: [] };
}

/** One round's parsed result from an ask_user_question tool call. */
export interface AskOutcome {
  done: boolean;
  qa: LedgerEntry[];
  assumptions: LedgerAssumption[];
}
