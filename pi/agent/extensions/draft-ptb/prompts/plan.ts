import type { DraftState } from "../state.ts";

export function buildPlanPrompt(state: DraftState): string {
  return (
    `You are writing an implementation plan for a developer with ZERO codebase context.\n` +
    `Your ONLY job is to call the draft_ptb_plan tool.\n\n` +
    `## Spec\n${state.spec}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n` +
    `## Plan Format\n\n` +
    `### Header (MANDATORY)\n` +
    `\`\`\`markdown\n` +
    `# [Feature] Implementation Plan\n\n` +
    `> **For agentic workers:** Execute task-by-task using subagents.\n\n` +
    `**Goal:** [One sentence]\n**Architecture:** [2-3 sentences]\n**Tech Stack:** [Key tech]\n---\n` +
    `\`\`\`\n\n` +
    `### File Structure\nMap ALL files before tasks. Locks decomposition decisions.\n\n` +
    `### Task Structure\n` +
    `\`\`\`markdown\n` +
    `### Task N: [Name]\n` +
    `**Files:** Create: \`path\` | Modify: \`path\`\n` +
    `- [ ] Step 1: Write failing test [code]\n` +
    `- [ ] Step 2: Run test, verify FAIL\n` +
    `- [ ] Step 3: Implement [code]\n` +
    `- [ ] Step 4: Run test, verify PASS\n` +
    `- [ ] Step 5: Commit\n` +
    `\`\`\`\n\n` +
    `### Granularity\nEach step = ONE action (2-5 min).\n\n` +
    `### FORBIDDEN\n` +
    `- "TBD", "TODO", "implement later"\n` +
    `- "Add appropriate error handling" (show actual code)\n` +
    `- "Write tests for the above" (show actual tests)\n` +
    `- "Similar to Task N" (repeat code — reader reads out of order)\n` +
    `- Steps describing WHAT without showing HOW\n` +
    `- References to undefined types/functions\n\n` +
    `### Self-Review\n` +
    `1. Every spec requirement has a task\n` +
    `2. No forbidden patterns\n` +
    `3. Names in later tasks match earlier definitions\n\n` +
    `Call draft_ptb_plan now.`
  );
}
