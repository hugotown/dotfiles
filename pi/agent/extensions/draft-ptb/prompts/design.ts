import type { DraftState } from "../state.ts";

export function buildDesignPrompt(state: DraftState): string {
  const u = state.understanding;
  const tr = u.testRequirements;
  const wantsTests = tr.wantsE2E || tr.wantsIntegration;
  const qa = state.answers.length
    ? state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")
    : "(no follow-up answers)";

  let prompt =
    `You are a senior architect writing a design specification.\n` +
    `Your ONLY job is to call the draft_ptb_spec_with_surface tool.\n\n` +
    `## Idea\n${state.idea}\n\n` +
    `## Chosen Approach\n**${state.chosenApproach?.name}:** ${state.chosenApproach?.description}\n` +
    `Tradeoffs: ${state.chosenApproach?.tradeoffs}\n\n` +
    `## Understanding\n` +
    `- User story: when=${u.userStory.when} | given=${u.userStory.given} | then=${u.userStory.then}\n` +
    `- Value: ${u.value}\n- Risks: ${u.risks.join("; ") || "(none)"}\n` +
    `- Non-goals: ${u.nonGoals.join("; ") || "(none)"}\n\n` +
    `## Q&A from user\n${qa}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n`;

  if (state.revisionFeedback) {
    prompt +=
      `## Previous Spec\n${state.spec}\n\n` +
      `## User Feedback\n${state.revisionFeedback}\n\n` +
      `Revise the spec addressing ALL feedback. Keep what was good. ` +
      `If a Test Surface section already existed, regenerate it consistently with the revisions.\n\n`;
  } else {
    prompt +=
      `## Design Principles\n` +
      `- **Isolation**: Units with one purpose and well-defined interfaces\n` +
      `- **Testability**: Each unit testable independently\n` +
      `- **Existing patterns**: Follow project conventions\n` +
      `- **YAGNI**: No speculative features\n` +
      `- **Boundaries**: Understandable without reading internals\n\n` +
      `## Required Sections (scale to complexity)\n` +
      `1. Architecture — components, responsibilities, composition\n` +
      `2. Data Flow — interfaces, data shapes, state management\n` +
      `3. Error Handling — failure modes, recovery, user-facing errors\n` +
      `4. Testing Strategy — what, how, what level\n` +
      `5. File Structure — exact paths for new/modified files\n\n`;
  }

  // Test surface section: only required if user opted in.
  if (wantsTests) {
    prompt +=
      `## Test Surface (REQUIRED in spec + structured arg)\n` +
      `The user opted in for tests (e2e=${tr.wantsE2E}, integration=${tr.wantsIntegration}).\n` +
      `Append a "## Test Surface" section to the spec markdown that enumerates, in human-readable form:\n` +
      `  - Each user journey (only if wantsE2E): id, name, steps in plain Spanish, invariants to assert.\n` +
      `  - Each integration boundary (only if wantsIntegration): id, modules involved, invariants.\n` +
      `In addition, fill the structured \`testSurface\` argument with the SAME content. ` +
      `Use stable kebab-case ids (e.g. "j-login-happy", "ib-payment-tax"). ` +
      `Derive journeys/invariants from the field × functionalRequirement × businessRule product in:\n` +
      `  - fields: ${tr.fields.length}\n` +
      `  - functionalRequirements: ${tr.functionalRequirements.length}\n` +
      `  - businessRules: ${tr.businessRules.length}\n`;
    if (!tr.wantsE2E) prompt += `Pass journeys=[] in the structured arg (user did NOT want e2e).\n`;
    if (!tr.wantsIntegration) prompt += `Pass integrationBoundaries=[] in the structured arg (user did NOT want integration).\n`;
    prompt += `\n`;
  } else {
    prompt +=
      `## Test Surface\n` +
      `User did NOT opt in for E2E or integration tests. ` +
      `Do NOT add a "## Test Surface" section to the spec markdown. ` +
      `Pass testSurface={ journeys: [], integrationBoundaries: [] } in the tool call.\n\n`;
  }

  prompt +=
    `## Self-Review Before Submitting\n` +
    `1. No "TBD"/"TODO"/vague requirements\n` +
    `2. No contradictions between sections\n` +
    `3. Focused enough for one implementation plan\n` +
    `4. No ambiguous requirements (pick one interpretation)\n` +
    `5. testSurface argument matches the "## Test Surface" markdown section (or both are empty)\n\n` +
    `Call draft_ptb_spec_with_surface now.`;

  return prompt;
}
