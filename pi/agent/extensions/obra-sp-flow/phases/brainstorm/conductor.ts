// Pure transition logic for the brainstorm question loop. No pi deps so it stays
// unit-testable; the glue (phases/brainstorm.ts + index.ts hooks) executes the
// effects these decisions imply.
//
// Principle (brainstorming has NO doubt budget): the loop ends only when BOTH
// sides have zero ambiguity. The LLM signals it has no more questions (done);
// then the user gets a 0-token gate to raise anything still unclear. Either side
// reopens the loop.

import type { BrainstormScratch } from "./types.ts";

export type QuestionsStep = "ask-again" | "user-gate";

/** While the LLM still has questions, keep asking. When it signals done, hand to
 *  the user gate. There is deliberately NO round cap. */
export function questionsStep(s: BrainstormScratch): QuestionsStep {
  return s.questionsDone ? "user-gate" : "ask-again";
}

/** Fold a user-raised doubt back into the loop: it becomes an open item and
 *  reopens questioning so the LLM resolves it. Empty input => unchanged. */
export function applyUserDoubt(s: BrainstormScratch, doubt: string): BrainstormScratch {
  const t = doubt.trim();
  if (!t) return s;
  return { ...s, questionsDone: false, ledger: [...s.ledger, { q: "User raised", a: t }] };
}
