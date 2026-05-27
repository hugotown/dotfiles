import type { DraftState } from "../state.ts";

export function buildDesignPrompt(state: DraftState): string {
  const qa = state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");

  let prompt =
    `You are a senior architect writing a design specification.\n` +
    `Your ONLY job is to call the draft_ptb_design tool.\n\n` +
    `## Idea\n${state.idea}\n\n` +
    `## Chosen Approach\n**${state.chosenApproach?.name}:** ${state.chosenApproach?.description}\n` +
    `Tradeoffs: ${state.chosenApproach?.tradeoffs}\n\n` +
    `## Research Context\n${qa}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n`;

  if (state.revisionFeedback) {
    prompt +=
      `## Previous Spec\n${state.spec}\n\n` +
      `## User Feedback\n${state.revisionFeedback}\n\n` +
      `Revise the spec addressing ALL feedback. Keep what was good.\n\n`;
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
      `5. File Structure — exact paths for new/modified files\n\n` +
      `## Self-Review Before Submitting\n` +
      `1. No "TBD"/"TODO"/vague requirements\n` +
      `2. No contradictions between sections\n` +
      `3. Focused enough for one implementation plan\n` +
      `4. No ambiguous requirements (pick one interpretation)\n\n`;
  }

  return prompt + `Call draft_ptb_design now.`;
}
