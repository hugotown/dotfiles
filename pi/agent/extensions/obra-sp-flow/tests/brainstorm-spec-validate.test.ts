import { describe, expect, test } from "bun:test";
import { validateSpec } from "../phases/brainstorm/spec-validate.ts";

const good = `## Overview
A weighted scorecard with sections and items that must each sum to 100%.

## Architecture
Mongoose model, Zod schema, tRPC router, and a document-id helper, each a small focused unit with one responsibility and a clear interface that callers depend on.

## Data flow
Create/update validate weights before persisting; reads are org-scoped.

## Error handling
Validation errors surface as tRPC BAD_REQUEST with the failing invariant.

## Acceptance Criteria

As a scorecard owner, I want to create a scorecard with weighted sections, so that I can evaluate items proportionally.

Scenario: Create a valid scorecard
  Given I am authenticated as an org member
  When I submit a scorecard with sections summing to 100%
  Then the scorecard is persisted and returned with its ID

Scenario: Reject invalid weights
  Given I am authenticated as an org member
  When I submit a scorecard with sections summing to 85%
  Then I receive a BAD_REQUEST error with the failing invariant

## Test strategy
Unit tests for the Zod schema, integration tests for the router CRUD + auth gate, e2e tracing every field; coverage > 90%.

## Decisions & Resolved Ambiguities
- Weights are integers 1..100 => enforced by Zod superRefine.
- Hard delete, no soft-delete => per user decision.
`;

describe("validateSpec", () => {
  test("a complete spec passes", () => {
    expect(validateSpec(good)).toEqual([]);
  });

  test("does NOT gate on placeholder mentions or the project's todoRouter", () => {
    expect(validateSpec(`${good}\n\nPlaceholder scan: no "TBD"/"TODO" left; follow the todo router.`).some((p) => p.includes("placeholder"))).toBe(false);
  });

  test("flags a missing decisions section", () => {
    const noDecisions = good.replace(/## Decisions & Resolved Ambiguities[\s\S]*/, "");
    expect(validateSpec(noDecisions).some((p) => p.includes("Decisions & Resolved Ambiguities"))).toBe(true);
  });

  test("flags a missing test strategy", () => {
    const noTests = good.replace(/## Test strategy[\s\S]*?\n\n/, "");
    expect(validateSpec(noTests).some((p) => p.includes("test strategy"))).toBe(true);
  });

  test("flags a too-short spec", () => {
    expect(validateSpec("## Decisions & Resolved Ambiguities\ntests").some((p) => p.includes("too short"))).toBe(true);
  });

  test("flags missing acceptance criteria (no Given/When/Then)", () => {
    const noGWT = good.replace(/## Acceptance Criteria[\s\S]*?(?=## Test strategy)/, "");
    expect(validateSpec(noGWT).some((p) => p.includes("acceptance criteria"))).toBe(true);
  });
});
