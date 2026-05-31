// Test-coverage reviewer prompt.
// Model: gemini-3.1-pro-preview (systematic enumeration + structured output).
//
// Job: verify that the generated tests actually exercise each journey + invariant
// declared in the test surface. Catches "test exists but only asserts truthy".

import type { DraftState } from "../state.ts";
import {
  renderTestContracts,
  renderTestSurface,
  buildOutputContract,
} from "./review-shared.ts";

export function buildReviewTestsPrompt(state: DraftState): string {
  const hasTestSurface =
    state.testSurface &&
    (state.testSurface.journeys.length > 0 || state.testSurface.integrationBoundaries.length > 0);

  // When the user did not opt in for tests, there is nothing to review — emit an
  // immediate "approved, no issues" verdict instead of dispatching a full prompt.
  if (!hasTestSurface) {
    return [
      `# Test-Coverage Reviewer (no test surface)`,
      ``,
      `The user did not opt in for tests. Emit an immediate approval:`,
      ``,
      buildOutputContract("draft_ptb_review_tests"),
      ``,
      `Required verdict: \`{ "approved": true, "issues": [] }\`.`,
    ].join("\n");
  }

  return [
    `# Test-Coverage Reviewer`,
    ``,
    `You are reviewing whether the generated tests actually cover the declared test`,
    `surface. You may use \`read\` to inspect any test file and \`bash\` for read-only`,
    `commands (cat, ls, grep, rg). Do NOT modify any file. Do NOT run tests.`,
    ``,
    `## Declared test surface`,
    ``,
    renderTestSurface(state.testSurface),
    ``,
    `## Declared test contracts`,
    ``,
    renderTestContracts(state.testContracts),
    ``,
    `## Your task`,
    ``,
    `Enumerate each journey and each integration boundary above. For each:`,
    `1. Identify which test file(s) claim to cover it (per the test contracts).`,
    `2. Read those files and check:`,
    `   - Is there at least one test that walks every step in the journey?`,
    `   - Is each declared invariant asserted by at least one test (not just`,
    `     "expect(result).toBeTruthy()")?`,
    `   - For integration boundaries: do tests actually exercise the boundary`,
    `     contract between the listed modules, or do they mock both sides?`,
    `3. Report any journey/invariant that has NO real test as a critical issue.`,
    `4. Report tests that exist but only smoke-check (assert truthy / not-null) as`,
    `   important issues — they pass without verifying behavior.`,
    ``,
    `Skip:`,
    `- Code-quality nits in test files (not your job).`,
    `- Suggestions to add tests beyond the declared surface (the user only asked for`,
    `  the surface listed above).`,
    ``,
    `Severity:`,
    `- **critical**: a declared invariant has no test at all, or every test for it`,
    `  is a smoke-check that passes without exercising behavior.`,
    `- **important**: a journey step is skipped, or an assertion is too loose to`,
    `  catch regressions in the invariant it claims to cover.`,
    `- **minor**: missing test descriptions, redundant assertions.`,
    ``,
    buildOutputContract("draft_ptb_review_tests"),
  ].join("\n");
}
