import { describe, expect, test } from "bun:test";
import { validatePlan } from "../phases/plan/plan-validate.ts";
import { initPlanScratch } from "../phases/plan/types.ts";

const good = `# Feature X Implementation Plan

**Goal:** Add the JobScorecard entity.
**Architecture:** Mongoose model + Zod schema + tRPC router, each a focused unit.
**Tech Stack:** TypeScript, Mongoose, tRPC, Zod, Vitest.

### Task 1: Model
**Files:** Create packages/db/src/models/job-scorecard.model.ts; Test tests/model.test.ts

- [ ] Step 1: write the failing test
\`\`\`ts
test("weights must sum to 100", () => { expect(validate(bad)).toThrow(); });
\`\`\`
- [ ] Step 2: run it; expected FAIL
- [ ] Step 3: implement the schema
- [ ] Step 4: run it; expected PASS; coverage > 90%
- [ ] Step 5: commit
`;

const contracts = [{ path: "packages/db/src/models/job-scorecard.model.ts", purpose: "schema", dependsOn: [] }];

describe("validatePlan", () => {
  test("a complete plan with contracts passes", () => {
    expect(validatePlan(good, contracts)).toEqual([]);
  });

  test("flags a missing file-contracts array", () => {
    expect(validatePlan(good, []).some((p) => p.includes("file-contracts"))).toBe(true);
    expect(validatePlan(good, null).some((p) => p.includes("file-contracts"))).toBe(true);
  });

  test("does NOT gate on placeholder mentions or the project's todoRouter", () => {
    expect(validatePlan(`${good}\nPlaceholder scan: no "TBD"/"TODO"; follow the todo router.`, contracts).some((p) => p.includes("placeholder"))).toBe(false);
  });

  test("flags a missing header", () => {
    expect(validatePlan("### Task 1\ntests and coverage here, long enough ".repeat(20), contracts).some((p) => p.includes("header"))).toBe(true);
  });

  test("flags a missing test strategy", () => {
    const noTests = "# Plan\n**Goal:** x\n**Architecture:** y\n".padEnd(600, ".");
    expect(validatePlan(noTests, contracts).some((p) => p.includes("TDD"))).toBe(true);
  });

  test("initPlanScratch starts at research", () => {
    expect(initPlanScratch().node).toBe("research");
  });
});
