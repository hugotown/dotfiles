import type { DraftState } from "../state.ts";

export function buildResearchPrompt(state: DraftState, graphifyAvailable: boolean): string {
  let prompt =
    `You are a senior architect conducting research for a feature design.\n` +
    `You have these tools: ask_user_question, draft_ptb_research, bash, read.\n\n`;

  if (graphifyAvailable) {
    prompt +=
      `## Step 1: Explore via knowledge graph\n` +
      `graphify-out/ exists. Run \`graphify query "<keywords>"\` via bash to understand:\n` +
      `- Existing architecture and component relationships\n` +
      `- Current patterns, conventions, data flows\n` +
      `- What relates to the user's idea\n\n` +
      `Run multiple queries until you have enough context. Then proceed.\n\n`;
  }

  const step = graphifyAvailable ? "2" : "1";
  prompt +=
    `## Step ${step}: Ask clarifying questions\n` +
    `Call ask_user_question with 3-5 questions:\n` +
    `- Focus on: purpose, constraints, success criteria, scope\n` +
    `- Prefer multiple choice options when possible\n` +
    `- Assess scope: if multiple independent subsystems, ask about decomposition\n` +
    `- Ask what ALREADY EXISTS that should be reused\n` +
    `- Ask about priorities and non-goals\n\n` +
    `## Step ${+step + 1}: Submit results\n` +
    `Call draft_ptb_research with all Q&A pairs.\n\n` +
    `## User's Idea\n${state.idea}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n` +
    `Begin ${graphifyAvailable ? "by querying the knowledge graph" : "by calling ask_user_question"}.`;

  return prompt;
}
