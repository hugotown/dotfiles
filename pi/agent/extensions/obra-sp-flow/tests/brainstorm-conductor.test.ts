import { describe, expect, test } from "bun:test";
import { applyUserDoubt, questionsStep } from "../phases/brainstorm/conductor.ts";
import { initBrainstormScratch } from "../phases/brainstorm/types.ts";

describe("brainstorm conductor", () => {
  test("keeps asking while the LLM is not done", () => {
    expect(questionsStep(initBrainstormScratch())).toBe("ask-again");
  });

  test("hands to the user gate once the LLM signals done", () => {
    expect(questionsStep({ ...initBrainstormScratch(), questionsDone: true })).toBe("user-gate");
  });

  test("a user doubt reopens the loop and is logged", () => {
    const s = applyUserDoubt({ ...initBrainstormScratch(), questionsDone: true }, "what about soft-delete?");
    expect(s.questionsDone).toBe(false);
    expect(s.ledger.at(-1)).toEqual({ q: "User raised", a: "what about soft-delete?" });
  });

  test("an empty user gate leaves state untouched (loop will advance)", () => {
    const base = { ...initBrainstormScratch(), questionsDone: true };
    expect(applyUserDoubt(base, "   ")).toBe(base);
  });
});
