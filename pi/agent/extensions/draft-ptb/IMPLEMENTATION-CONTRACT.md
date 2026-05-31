# draft-ptb v2 — Implementation Contract

This document is the SHARED CONTRACT that ALL 4 milestone subagents must respect.
NONE of them may invent fields, rename events, or alter file structures defined here.

## File ownership (NO subagent writes outside its files)

| Milestone | Owns (writes) | Reads (cannot modify) |
|---|---|---|
| M1 | `state.ts` (PARTIAL — additions only), `reducer.ts` (PARTIAL), `context-builder.ts`, `prompts/research.ts`, `prompts/completeness.ts` (new), `tools.ts` (additions) | `index.ts`, `orchestrator.ts`, `drive-phase.ts` |
| M2 | `prompts/spec.ts` (new), `prompts/plan.ts` (rewrite), `prompts/approaches.ts`, `state.ts` (additions), `reducer.ts` (additions), `tools.ts` (additions), `config.ts` (additions) | M1 outputs |
| M3 | `prompts/test-generation.ts` (new), `prompts/implementer.ts` (new), `parallel-dispatcher.ts` (new), `dag.ts` (new), `deterministic-checks.ts` (new), `tools.ts` (additions), `state.ts` (additions), `reducer.ts` (additions), `config.ts` (additions) | M1+M2 outputs |
| M4 | `prompts/review-contracts.ts`, `prompts/review-quality.ts`, `prompts/review-tests.ts` (3 new), `git-ops.ts` (new), `iterate-or-ship.ts` (new), `state.ts` (additions), `reducer.ts` (additions), `tools.ts` (additions), `config.ts` (additions) | M1+M2+M3 outputs |

## Shared `state.ts` — additive only

Every milestone APPENDS its fields to `DraftState` and `DraftEvent`. NO renames, NO removals.

### Phase enum (final, all 13 values; subagents may NOT add more)

```ts
export type Phase =
  | "IDLE"
  | "GATHERING_CONTEXT"
  | "RESEARCH"
  | "COMPLETENESS_CHECK"
  | "APPROACHES"
  | "DESIGN"
  | "PLAN"
  | "PARALLEL_IMPLEMENTATION"
  | "TEST_GENERATION"
  | "DETERMINISTIC_CHECKS"
  | "LLM_REVIEW"
  | "ITERATE_OR_SHIP"
  | "COMPLETE";
```

### DraftState additions (alphabetical, by milestone)

```ts
// M1 additions
gitInfo: {
  hasGit: boolean;
  baseBranch: string | null;
  snapshotSha: string | null;
  currentBranch: string | null;
  featureBranch: string | null;
};
projectInfo: {
  manifests: string[];        // ['package.json', 'Cargo.toml', ...]
  types: string[];            // ['node', 'rust', ...]
  isMonorepo: boolean;
  workspaces: string[];
  hasPlaywright: boolean;
  hasCypress: boolean;
  testFolders: { e2e: string; integration: string };
  obsidianPath: string;
};
understanding: {
  userStory: { when: string; given: string; then: string };
  why: string;
  value: string;
  risks: string[];
  existingSolutions: string;
  reusableComponents: string;
  assumptions: string[];
  nonGoals: string[];
  scopeCheck: { isDecomposable: boolean; subProjects: string[] };
  testRequirements: {
    wantsE2E: boolean;
    wantsIntegration: boolean;
    fields: Array<{ name: string; type: string; source: string; validation: string }>;
    functionalRequirements: Array<{ id: string; description: string; criteria: string[] }>;
    businessRules: Array<{ id: string; description: string; scope: string }>;
  };
};
completenessIterations: number;
completenessResult: { complete: boolean; missingInfo: string[] } | null;

// M2 additions
testSurface: {
  journeys: Array<{ id: string; name: string; steps: string[]; invariants: string[] }>;
  integrationBoundaries: Array<{ id: string; modules: string[]; invariants: string[] }>;
} | null;
fileContracts: Array<{
  path: string;
  purpose: string;
  exports: Array<{ name: string; signature: string; description: string }>;
  imports: string[];                  // paths of OTHER contracts this file depends on
  dependsOn: string[];                // task IDs this contract waits for
}>;
sharedFiles: string[];
infraTask: {
  id: string;
  files: string[];
  description: string;
} | null;
testContracts: Array<{
  path: string;
  kind: "workbook" | "playwright" | "integration";
  journey: string;                    // refs testSurface.journeys[].id or boundary id
  codeContractsUnderTest: string[];   // paths of fileContracts
}>;

// M3 additions
implementationResults: Array<{
  taskId: string;
  status: "DONE" | "DONE_WITH_CONCERNS" | "BLOCKED" | "NEEDS_CONTEXT";
  filesWritten: string[];
  commit: string | null;
  concerns: string | null;
}>;
testGenerationResults: Array<{
  testPath: string;
  status: "DONE" | "BLOCKED";
  artifact: "workbook" | "playwright" | "integration";
}>;
checksResult: {
  typecheck: { passed: boolean; output: string };
  lint: { passed: boolean; output: string };
  tests: { passed: boolean; output: string };
  workbooks: Array<{ path: string; passed: boolean; output: string }>;
} | null;

// M4 additions
reviewResults: {
  contracts: { approved: boolean; issues: ReviewIssue[] };
  quality: { approved: boolean; issues: ReviewIssue[] };
  tests: { approved: boolean; issues: ReviewIssue[] };
} | null;
iterationCount: number;        // max 3 (escalates to user if exceeded)
shipResult: {
  committed: boolean;
  pushed: boolean;
  prUrl: string | null;
} | null;

// ReviewIssue type (shared by M4 reviewers)
export interface ReviewIssue {
  severity: "critical" | "important" | "minor";
  file: string;
  line: number | null;
  description: string;
  fixSuggestion: string;
}
```

### DraftEvent additions (each milestone adds its events)

```ts
// M1 additions
| { type: "PROJECT_DETECTED"; projectInfo: ProjectInfo; gitInfo: GitInfo }
| { type: "UNDERSTANDING_RECEIVED"; understanding: Understanding }
| { type: "COMPLETENESS_CHECKED"; result: CompletenessResult }

// M2 additions (extend SPEC_RECEIVED + PLAN_RECEIVED)
| { type: "TEST_SURFACE_RECEIVED"; testSurface: TestSurface }
| { type: "CONTRACTS_RECEIVED"; fileContracts: FileContract[]; sharedFiles: string[]; infraTask: InfraTask | null; testContracts: TestContract[] }

// M3 additions
| { type: "IMPLEMENTATION_DONE"; results: ImplementationResult[] }
| { type: "TEST_GENERATION_DONE"; results: TestGenerationResult[] }
| { type: "CHECKS_RAN"; result: ChecksResult }

// M4 additions
| { type: "REVIEW_RAN"; result: ReviewResults }
| { type: "ITERATION_NEEDED"; targets: string[] }
| { type: "SHIPPED"; result: ShipResult }
```

## Shared reducer.ts pattern

Each milestone ADDS cases to the switch. Pattern:

```ts
case "NEW_PHASE":
  if (event.type === "EVENT_NAME")
    return { ...state, phase: "NEXT_PHASE", fieldName: event.fieldName };
  return state;
```

NO milestone may modify existing cases. Only adds NEW cases for NEW phases.

## Shared config.ts pattern (PHASE_CONFIG)

Each milestone APPENDS entries to PHASE_CONFIG. Models from settings.json only.

```ts
export const PHASE_CONFIG: Partial<Record<Phase, PhaseConfig>> = {
  // existing entries from v1...
  // M1 adds: COMPLETENESS_CHECK
  // M2 adds: (none new — APPROACHES/DESIGN/PLAN already exist)
  // M3 adds: PARALLEL_IMPLEMENTATION, TEST_GENERATION, DETERMINISTIC_CHECKS
  // M4 adds: LLM_REVIEW, ITERATE_OR_SHIP
};
```

## Shared tools.ts pattern

Each milestone APPENDS new `pi.registerTool({ ... })` calls inside `registerTools(pi, get, set)`. NO milestone may modify existing tools.

New tools per milestone:
- M1: `draft_ptb_understanding`, `draft_ptb_completeness_check`
- M2: `draft_ptb_spec_with_surface`, `draft_ptb_plan_with_contracts`
- M3: (implementer/test subagents don't use these tools — they use core pi tools)
- M4: `draft_ptb_review_contracts`, `draft_ptb_review_quality`, `draft_ptb_review_tests`

## drive-phase.ts coordination (M1 owner, others must NOT touch)

drive-phase.ts has a switch on `state.phase`. Each milestone ADDS its case. M1 is the owner of this file; M2/M3/M4 must ASK M1 (via this contract) to add their cases. To avoid coordination conflicts, ALL cases are added by M1 BEFORE other milestones run their work, based on this contract.

## Model assignments (from settings.json — exact names)

| Phase | Provider | Model | Why |
|---|---|---|---|
| DEEP_UNDERSTANDING (RESEARCH) | github-copilot | claude-sonnet-4.6 | research + entendimiento |
| COMPLETENESS_CHECK | github-copilot | claude-sonnet-4.6 | validar respuestas |
| APPROACHES | github-copilot | claude-sonnet-4.6 | proponer enfoques |
| DESIGN (SPEC) | github-copilot | claude-opus-4.7 | síntesis crítica |
| PLAN | github-copilot | claude-opus-4.7 | contratos + DAG |
| PARALLEL_IMPLEMENTATION (per-subagent) | github-copilot | claude-sonnet-4.6 | implementación mecánica |
| TEST_GENERATION (per-subagent) | github-copilot | claude-sonnet-4.6 | escribir tests concretos |
| LLM_REVIEW contracts | github-copilot | claude-opus-4.7 | anclaje crítico |
| LLM_REVIEW quality | github-copilot | gpt-5.4 | diversidad razonamiento |
| LLM_REVIEW tests | github-copilot | gemini-3.1-pro-preview | enumeración sistemática + structured output |

## File path conventions (REUSE existing file-ops.ts helpers)

- Brainstorming: `<obsidianPath>/brainstorming.md` (already implemented)
- Spec: `<obsidianPath>/spec.md` (already implemented)
- Plan: `<obsidianPath>/plan.md` (already implemented)
- Runs: `<obsidianPath>/runs/<ISO>.json` (already implemented)
- M3 backup (no-git mode): `<cwd>/.draft-ptb-backup/<relative-path-of-modified-file>`

## Non-negotiables

1. NO subagent may load any traditional skill
2. NO subagent may add fields to state.ts that aren't in this contract
3. NO subagent may rename phase names from the enum above
4. NO subagent may invent new models — only those listed
5. NO subagent may modify `file-ops.ts`, `orchestrator.ts`, or `index.ts` (M1 owns drive-phase additions)
6. ALL new files must be in `prompts/` (for prompt builders) or root of `draft-ptb/` (for orchestration helpers)
7. NO commit attribution to AI
8. Code in English, comments in English. Spanish only for user-facing notify() strings.
