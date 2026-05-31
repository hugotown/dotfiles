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

export interface Question {
  question: string;
  options?: string[];
}

export interface Answer {
  question: string;
  answer: string;
}

export interface Approach {
  name: string;
  description: string;
  tradeoffs: string;
}

// M1 additions
export interface GitInfo {
  hasGit: boolean;
  baseBranch: string | null;
  snapshotSha: string | null;
  currentBranch: string | null;
  featureBranch: string | null;
}

export interface ProjectInfo {
  manifests: string[];
  types: string[];
  isMonorepo: boolean;
  workspaces: string[];
  hasPlaywright: boolean;
  hasCypress: boolean;
  testFolders: { e2e: string; integration: string };
  obsidianPath: string;
}

export interface TestRequirements {
  wantsE2E: boolean;
  wantsIntegration: boolean;
  fields: Array<{ name: string; type: string; source: string; validation: string }>;
  functionalRequirements: Array<{ id: string; description: string; criteria: string[] }>;
  businessRules: Array<{ id: string; description: string; scope: string }>;
}

export interface Understanding {
  userStory: { when: string; given: string; then: string };
  why: string;
  value: string;
  risks: string[];
  existingSolutions: string;
  reusableComponents: string;
  assumptions: string[];
  nonGoals: string[];
  scopeCheck: { isDecomposable: boolean; subProjects: string[] };
  testRequirements: TestRequirements;
}

export interface CompletenessResult {
  complete: boolean;
  missingInfo: string[];
}

// M2 additions
export interface TestJourney {
  id: string;
  name: string;
  steps: string[];
  invariants: string[];
}

export interface IntegrationBoundary {
  id: string;
  modules: string[];
  invariants: string[];
}

export interface TestSurface {
  journeys: TestJourney[];
  integrationBoundaries: IntegrationBoundary[];
}

export interface FileContractExport {
  name: string;
  signature: string;
  description: string;
}

export interface FileContract {
  path: string;
  purpose: string;
  exports: FileContractExport[];
  imports: string[];
  dependsOn: string[];
}

export interface InfraTask {
  id: string;
  files: string[];
  description: string;
}

export interface TestContract {
  path: string;
  kind: "workbook" | "playwright" | "integration";
  journey: string;
  codeContractsUnderTest: string[];
}

// M3 additions
export interface ImplementationResult {
  taskId: string;
  status: "DONE" | "DONE_WITH_CONCERNS" | "BLOCKED" | "NEEDS_CONTEXT";
  filesWritten: string[];
  commit: string | null;
  concerns: string | null;
}

export interface TestGenerationResult {
  testPath: string;
  status: "DONE" | "BLOCKED";
  artifact: "workbook" | "playwright" | "integration";
}

export interface CheckOutput {
  passed: boolean;
  output: string;
}

export interface WorkbookCheck {
  path: string;
  passed: boolean;
  output: string;
}

export interface ChecksResult {
  typecheck: CheckOutput;
  lint: CheckOutput;
  tests: CheckOutput;
  workbooks: WorkbookCheck[];
}

// M4 additions
export interface ReviewIssue {
  severity: "critical" | "important" | "minor";
  file: string;
  line: number | null;
  description: string;
  fixSuggestion: string;
}

export interface ReviewDimensionResult {
  approved: boolean;
  issues: ReviewIssue[];
}

export interface ReviewResults {
  contracts: ReviewDimensionResult;
  quality: ReviewDimensionResult;
  tests: ReviewDimensionResult;
}

export interface ShipResult {
  committed: boolean;
  pushed: boolean;
  prUrl: string | null;
  /** True when ship was abandoned because review/checks exceeded the iteration cap. */
  failed: boolean;
  /** Human-readable reason set when `failed` is true. */
  failureReason: string | null;
}

export interface DraftState {
  phase: Phase;
  idea: string;
  /** Absolute path to the per-feature Obsidian folder. Set on START. */
  featureFolder: string;
  /** Started-at ISO timestamp. Set on START. Used for the runs/<ts>.json filename. */
  startedAt: string;
  compressedContext: string;
  questions: Question[];
  answers: Answer[];
  brainstormingPath: string | null;
  approaches: Approach[];
  recommendation: string;
  chosenApproach: Approach | null;
  specTitle: string;
  spec: string;
  specPath: string | null;
  revisionFeedback: string;
  plan: string;
  planPath: string | null;
  originalModel: { provider: string; id: string } | null;
  allToolNames: string[];

  // M1 additions
  gitInfo: GitInfo;
  projectInfo: ProjectInfo;
  understanding: Understanding;
  completenessIterations: number;
  completenessResult: CompletenessResult | null;

  // M2 additions
  testSurface: TestSurface | null;
  fileContracts: FileContract[];
  sharedFiles: string[];
  infraTask: InfraTask | null;
  testContracts: TestContract[];

  // M3 additions
  implementationResults: ImplementationResult[];
  testGenerationResults: TestGenerationResult[];
  checksResult: ChecksResult | null;

  // M4 additions
  reviewResults: ReviewResults | null;
  iterationCount: number;
  shipResult: ShipResult | null;
  /** Per-iteration history for escalation summaries (oldest first). */
  iterationHistory: Array<{
    iteration: number;
    reason: string;
    failedFiles: string[];
  }>;
}

export type DraftEvent =
  | { type: "START" }
  | { type: "CONTEXT_READY"; compressedContext: string }
  | { type: "QUESTIONS_RECEIVED"; questions: Question[] }
  | { type: "ANSWERS_COLLECTED"; answers: Answer[]; brainstormingPath: string }
  | { type: "APPROACHES_RECEIVED"; approaches: Approach[]; recommendation: string }
  | { type: "APPROACH_CHOSEN"; approach: Approach }
  | { type: "SPEC_RECEIVED"; title: string; spec: string }
  | { type: "SPEC_APPROVED"; specPath: string }
  | { type: "SPEC_REVISION_REQUESTED"; feedback: string }
  | { type: "PLAN_RECEIVED"; plan: string }
  | { type: "PLAN_SAVED"; planPath: string }
  | { type: "RESET" }
  // M1 additions
  | { type: "PROJECT_DETECTED"; projectInfo: ProjectInfo; gitInfo: GitInfo; tree: string }
  | { type: "UNDERSTANDING_RECEIVED"; understanding: Understanding; openQuestions: Question[] }
  | { type: "COMPLETENESS_CHECKED"; result: CompletenessResult }
  | { type: "COMPLETENESS_LOOP"; reason: string }
  | { type: "COMPLETENESS_ADVANCE" }
  // M2 additions
  | { type: "TEST_SURFACE_RECEIVED"; testSurface: TestSurface }
  | {
      type: "CONTRACTS_RECEIVED";
      fileContracts: FileContract[];
      sharedFiles: string[];
      infraTask: InfraTask | null;
      testContracts: TestContract[];
    }
  // M3 additions
  | { type: "IMPLEMENTATION_DONE"; results: ImplementationResult[] }
  | { type: "TEST_GENERATION_DONE"; results: TestGenerationResult[] }
  | { type: "CHECKS_RAN"; result: ChecksResult }
  // M4 additions
  | { type: "REVIEW_RAN"; result: ReviewResults }
  | { type: "ITERATION_NEEDED"; targets: string[]; reason: string }
  | { type: "SHIPPED"; result: ShipResult };
