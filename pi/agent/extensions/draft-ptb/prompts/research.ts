import type { DraftState } from "../state.ts";

export function buildResearchPrompt(state: DraftState, graphifyAvailable: boolean): string {
  const looping = state.completenessResult && !state.completenessResult.complete;
  const missing = looping
    ? `## Previous round was incomplete\n${state.completenessResult!.missingInfo.map((m) => `- ${m}`).join("\n")}\n\nFocus this round on resolving those gaps.\n\n`
    : "";

  const manifests = state.projectInfo.manifests.join(", ") || "(none detected)";
  const types = state.projectInfo.types.join(", ") || "(unknown)";
  const monorepo = state.projectInfo.isMonorepo
    ? `monorepo (workspaces: ${state.projectInfo.workspaces.join(", ") || "n/a"})`
    : "single package";

  let prompt =
    `You are a senior architect doing DEEP UNDERSTANDING for a new feature.\n` +
    `Your job: investigate the codebase enough to fill the draft_ptb_understanding tool with high-signal content.\n\n` +
    `You have these tools: bash (read-only), read, ast-grep` +
    (graphifyAvailable ? ", graphify" : "") +
    `, draft_ptb_understanding.\n\n` +
    missing +
    `## User's Idea\n${state.idea}\n\n` +
    `## Project\n` +
    `- Types: ${types}\n` +
    `- Manifests: ${manifests}\n` +
    `- Structure: ${monorepo}\n` +
    `- Tests: playwright=${state.projectInfo.hasPlaywright}, cypress=${state.projectInfo.hasCypress}, ` +
    `e2e folder=${state.projectInfo.testFolders.e2e}, integration folder=${state.projectInfo.testFolders.integration}\n` +
    `- Git: hasGit=${state.gitInfo.hasGit}, currentBranch=${state.gitInfo.currentBranch ?? "n/a"}, ` +
    `baseBranch=${state.gitInfo.baseBranch ?? "n/a"}\n\n` +
    `## Project tree\n\`\`\`\n${state.compressedContext}\n\`\`\`\n\n`;

  if (graphifyAvailable) {
    prompt +=
      `## Recommended: use graphify\n` +
      `graphify-out/ exists. Run \`graphify query "<keywords>"\` via bash to understand architecture, existing patterns, and what relates to the idea.\n\n`;
  }

  prompt +=
    `## What to fill in draft_ptb_understanding\n` +
    `- userStory: when/given/then in plain language.\n` +
    `- why, value: the problem and the user-visible benefit.\n` +
    `- risks: concrete failure modes.\n` +
    `- existingSolutions, reusableComponents: what's already in the repo we can extend.\n` +
    `- assumptions, nonGoals: be explicit.\n` +
    `- scopeCheck: if the idea decomposes into independent sub-projects, list them.\n` +
    `- testRequirements: best guess for wantsE2E / wantsIntegration. Enumerate fields (with type, source, validation), ` +
    `functionalRequirements (id+description+criteria), and businessRules (id+description+scope). The user will confirm wantsE2E/wantsIntegration after.\n` +
    `- openQuestions: 3-7 SHARP questions for the user. Each can have multiple-choice options.\n\n` +
    `## Guidelines\n` +
    `- Investigate BEFORE filling. Read relevant files, query graphify, run ast-grep on key symbols.\n` +
    `- No placeholders. If a field truly doesn't apply, leave the array empty.\n` +
    `- Open questions must drive decisions; avoid yes/no-only.\n\n` +
    `Begin by exploring the codebase, then call draft_ptb_understanding exactly once.`;

  return prompt;
}
