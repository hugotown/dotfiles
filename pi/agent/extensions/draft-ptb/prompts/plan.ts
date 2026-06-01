import type { DraftState } from "../state.ts";

export function buildPlanPrompt(state: DraftState): string {
  const ts = state.testSurface;
  const wantsTests = !!ts && (ts.journeys.length > 0 || ts.integrationBoundaries.length > 0);
  const surfaceSummary = wantsTests
    ? `Spec test surface: journeys=${ts!.journeys.map((j) => j.id).join(", ") || "(none)"}; ` +
      `boundaries=${ts!.integrationBoundaries.map((b) => b.id).join(", ") || "(none)"}.`
    : `No test surface in spec; do NOT generate testContracts.`;

  return (
    `You are writing an implementation plan for a developer with ZERO codebase context.\n` +
    `Your ONLY job is to call the draft_ptb_plan_with_contracts tool.\n\n` +
    `## Spec\n${state.spec}\n\n` +
    `## Project Context\n${state.compressedContext}\n\n` +
    `## Test Surface\n${surfaceSummary}\n\n` +
    `## Tool Output (4 things at once)\n` +
    `Call draft_ptb_plan_with_contracts with:\n` +
    `  - plan: the markdown plan (format below)\n` +
    `  - fileContracts: array describing EACH new/modified source file\n` +
    `  - sharedFiles: paths touched by MORE than one task (e.g. package.json, tsconfig.json)\n` +
    `  - infraTask: a single solo task that owns sharedFiles, or null if sharedFiles is empty\n` +
    `  - testContracts: one entry per test file derived from the test surface (workbook + playwright + integration)\n\n` +
    `## Plan Markdown Format\n` +
    `\`\`\`markdown\n` +
    `# [Feature] Implementation Plan\n\n` +
    `> **For agentic workers:** Execute task-by-task using subagents in DAG order.\n\n` +
    `**Goal:** [One sentence]\n**Architecture:** [2-3 sentences]\n**Tech Stack:** [Key tech]\n\n---\n\n` +
    `## File Contracts\n` +
    `For each file: path, purpose, exports with TypeScript-like signatures, imports (other contract paths), depends-on (task ids).\n\n` +
    `## Infra Task\n` +
    `(Only if sharedFiles.length > 0. Describe the single task that touches them BEFORE any DAG level runs.)\n\n` +
    `## Test Contracts\n` +
    `(Only if test surface is non-empty. List each test file, its kind, the journey/boundary it covers, and the file contracts under test.)\n\n` +
    `## Tasks\n` +
    `### Task N: [Name]\n` +
    `**File contract:** \`path\`\n` +
    `**Depends on:** Task X, Task Y (must match fileContracts.dependsOn)\n` +
    `- [ ] Step 1: Write failing test [code]\n` +
    `- [ ] Step 2: Run test, verify FAIL\n` +
    `- [ ] Step 3: Implement [code]\n` +
    `- [ ] Step 4: Run test, verify PASS\n` +
    `- [ ] Step 5: Commit\n` +
    `\`\`\`\n\n` +
    `## fileContracts rules\n` +
    `- One entry per file the implementation creates or modifies (excluding shared files — those belong to infraTask).\n` +
    `- \`path\` is repo-relative.\n` +
    `- \`exports[].signature\` is a TypeScript-like one-liner, even for non-TS languages (close approximation).\n` +
    `- \`imports\` lists paths of OTHER fileContracts this file consumes (NOT external libs).\n` +
    `- \`dependsOn\` lists task ids that must finish first (used to build the DAG). Use "task-1", "task-2", … matching the markdown.\n\n` +
    `## sharedFiles + infraTask rules\n` +
    `- A file is "shared" if more than one task would otherwise modify it.\n` +
    `- Put all shared files inside ONE infraTask. Its id is "task-infra" by convention. Other tasks may then assume those changes exist.\n` +
    `- If there are no shared files, set sharedFiles=[] and infraTask=null.\n\n` +
    `## testContracts rules\n` +
    `- Generate testContracts ONLY when the spec has a non-empty test surface.\n` +
    `- For each E2E journey, emit TWO entries: kind="workbook" and kind="playwright", same journey id.\n` +
    `- For each integration boundary, emit ONE entry: kind="integration", journey=<boundaryId>.\n` +
    `- \`codeContractsUnderTest\` lists fileContract paths the test exercises.\n\n` +
    `## Design Principles\n` +
    `- **SOLID:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion. ` +
    `Every file contract must have ONE clear responsibility. If a file does two things, split it.\n` +
    `- **DRY (Don't Repeat Yourself):** Extract shared logic into its own file contract. ` +
    `If two tasks need the same helper/type/utility, that belongs in a shared contract or infraTask.\n` +
    `- **File Size Constraint:** Each file MUST NOT exceed 70 lines of functional code (excluding blank lines and comments). ` +
    `Maximum 97 lines total (including blanks and comments). If a file would exceed this, decompose it into smaller focused modules.\n\n` +
    `## Granularity\nEach step = ONE action (2-5 min).\n\n` +
    `## FORBIDDEN\n` +
    `- "TBD", "TODO", "implement later"\n` +
    `- "Add appropriate error handling" (show actual code)\n` +
    `- "Write tests for the above" (show actual tests)\n` +
    `- "Similar to Task N" (repeat code — reader reads out of order)\n` +
    `- Steps describing WHAT without showing HOW\n` +
    `- References to undefined types/functions\n\n` +
    `## Self-Review\n` +
    `1. Every spec requirement has a task\n` +
    `2. fileContracts cover EXACTLY the files the tasks mention (minus sharedFiles)\n` +
    `3. dependsOn refs are acyclic\n` +
    `4. testContracts cover EVERY journey + EVERY boundary in the spec test surface\n` +
    `5. No forbidden patterns\n\n` +
    `Call draft_ptb_plan_with_contracts now.`
  );
}
