import { describe, expect, test } from "bun:test";
import { applyOutcome, parseAskOutcome, renderLedger } from "../phases/brainstorm/ledger.ts";
import { initBrainstormScratch } from "../phases/brainstorm/types.ts";

describe("brainstorm ledger", () => {
  test("parseAskOutcome pulls done + qa + assumptions from input/details", () => {
    const o = parseAskOutcome(
      { done: true, assumptions: [{ text: "DB may be wiped", confidence: "high" }] },
      { answers: [{ question: "Weights 0-100 or 1-100?", answer: "1-100" }] },
    );
    expect(o.done).toBe(true);
    expect(o.qa).toEqual([{ q: "Weights 0-100 or 1-100?", a: "1-100" }]);
    expect(o.assumptions).toEqual([{ text: "DB may be wiped", confidence: "high" }]);
  });

  test("parseAskOutcome tolerates missing fields (degrades, never throws)", () => {
    expect(parseAskOutcome({}, undefined)).toEqual({ done: false, qa: [], assumptions: [] });
    expect(parseAskOutcome(null, null)).toEqual({ done: false, qa: [], assumptions: [] });
  });

  test("applyOutcome folds rounds/ledger and dedupes assumptions by text", () => {
    let s = initBrainstormScratch();
    const o = parseAskOutcome(
      { done: false, assumptions: [{ text: "A", confidence: "low" }] },
      { answers: [{ question: "Q1", answer: "A1" }] },
    );
    s = applyOutcome(s, o);
    s = applyOutcome(s, o);
    expect(s.rounds).toBe(2);
    expect(s.ledger).toHaveLength(2);
    expect(s.assumptions).toHaveLength(1);
    expect(s.questionsDone).toBe(false);
  });

  test("renderLedger emits compact Q=>A and assumption lines", () => {
    let s = initBrainstormScratch();
    s = applyOutcome(
      s,
      parseAskOutcome({ done: false, assumptions: [{ text: "wipe ok", confidence: "high" }] }, { answers: [{ question: "Q1", answer: "A1" }] }),
    );
    const text = renderLedger(s);
    expect(text).toContain("Q1 => A1");
    expect(text).toContain("(high) wipe ok");
  });

  test("renderLedger on empty scratch is empty", () => {
    expect(renderLedger(initBrainstormScratch())).toBe("");
  });
});
