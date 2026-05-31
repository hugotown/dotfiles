import type { DraftState, DraftEvent, Understanding, GitInfo, ProjectInfo, Phase } from "./state.ts";

const EMPTY_GIT: GitInfo = {
  hasGit: false,
  baseBranch: null,
  snapshotSha: null,
  currentBranch: null,
  featureBranch: null,
};

const EMPTY_PROJECT: ProjectInfo = {
  manifests: [],
  types: [],
  isMonorepo: false,
  workspaces: [],
  hasPlaywright: false,
  hasCypress: false,
  testFolders: { e2e: "", integration: "" },
  obsidianPath: "",
};

const EMPTY_UNDERSTANDING: Understanding = {
  userStory: { when: "", given: "", then: "" },
  why: "",
  value: "",
  risks: [],
  existingSolutions: "",
  reusableComponents: "",
  assumptions: [],
  nonGoals: [],
  scopeCheck: { isDecomposable: false, subProjects: [] },
  testRequirements: {
    wantsE2E: false,
    wantsIntegration: false,
    fields: [],
    functionalRequirements: [],
    businessRules: [],
  },
};

export function createInitialState(idea: string): DraftState {
  return {
    phase: "IDLE",
    idea,
    featureFolder: "",
    startedAt: "",
    compressedContext: "",
    questions: [],
    answers: [],
    brainstormingPath: null,
    approaches: [],
    recommendation: "",
    chosenApproach: null,
    specTitle: "",
    spec: "",
    specPath: null,
    revisionFeedback: "",
    plan: "",
    planPath: null,
    originalModel: null,
    allToolNames: [],
    gitInfo: EMPTY_GIT,
    projectInfo: EMPTY_PROJECT,
    understanding: EMPTY_UNDERSTANDING,
    completenessIterations: 0,
    completenessResult: null,
    testSurface: null,
    fileContracts: [],
    sharedFiles: [],
    infraTask: null,
    testContracts: [],
    implementationResults: [],
    testGenerationResults: [],
    checksResult: null,
    reviewResults: null,
    iterationCount: 0,
    shipResult: null,
    iterationHistory: [],
  };
}

export function transition(state: DraftState, event: DraftEvent): DraftState {
  if (event.type === "RESET") return { ...state, phase: "IDLE" };

  switch (state.phase) {
    case "IDLE":
      if (event.type === "START") return { ...state, phase: "GATHERING_CONTEXT" };
      return state;

    case "GATHERING_CONTEXT":
      if (event.type === "PROJECT_DETECTED")
        return {
          ...state,
          phase: "RESEARCH",
          projectInfo: event.projectInfo,
          gitInfo: event.gitInfo,
          compressedContext: event.tree,
        };
      return state;

    case "RESEARCH":
      if (event.type === "UNDERSTANDING_RECEIVED")
        return { ...state, understanding: event.understanding, questions: event.openQuestions };
      if (event.type === "ANSWERS_COLLECTED")
        return {
          ...state,
          phase: "COMPLETENESS_CHECK",
          answers: event.answers,
          brainstormingPath: event.brainstormingPath,
        };
      return state;

    case "COMPLETENESS_CHECK":
      // Tool stores the result; handler picks loop vs advance.
      if (event.type === "COMPLETENESS_CHECKED")
        return { ...state, completenessResult: event.result };
      if (event.type === "COMPLETENESS_LOOP")
        return { ...state, phase: "RESEARCH", completenessIterations: state.completenessIterations + 1 };
      if (event.type === "COMPLETENESS_ADVANCE")
        return { ...state, phase: "APPROACHES" };
      return state;

    case "APPROACHES":
      if (event.type === "APPROACHES_RECEIVED")
        return { ...state, approaches: event.approaches, recommendation: event.recommendation };
      if (event.type === "APPROACH_CHOSEN")
        return { ...state, phase: "DESIGN", chosenApproach: event.approach };
      return state;

    case "DESIGN":
      if (event.type === "SPEC_RECEIVED")
        return { ...state, specTitle: event.title, spec: event.spec };
      if (event.type === "TEST_SURFACE_RECEIVED")
        return { ...state, testSurface: event.testSurface };
      if (event.type === "SPEC_APPROVED")
        return { ...state, phase: "PLAN", specPath: event.specPath };
      if (event.type === "SPEC_REVISION_REQUESTED")
        return { ...state, revisionFeedback: event.feedback };
      return state;

    case "PLAN":
      if (event.type === "PLAN_RECEIVED") return { ...state, plan: event.plan };
      if (event.type === "CONTRACTS_RECEIVED")
        return {
          ...state,
          fileContracts: event.fileContracts,
          sharedFiles: event.sharedFiles,
          infraTask: event.infraTask,
          testContracts: event.testContracts,
        };
      if (event.type === "PLAN_SAVED") {
        // M3 path: if M2 produced file contracts, drive parallel implementation.
        // Legacy path: no contracts → go straight to COMPLETE (kept for safety).
        const next: Phase = state.fileContracts.length > 0 ? "PARALLEL_IMPLEMENTATION" : "COMPLETE";
        return { ...state, phase: next, planPath: event.planPath };
      }
      return state;

    case "PARALLEL_IMPLEMENTATION":
      if (event.type === "IMPLEMENTATION_DONE") {
        // After implementation, run TEST_GENERATION only if there are test contracts.
        // Otherwise, skip directly to DETERMINISTIC_CHECKS (D7: tests after code).
        const next: Phase = state.testContracts.length > 0 ? "TEST_GENERATION" : "DETERMINISTIC_CHECKS";
        return { ...state, phase: next, implementationResults: event.results };
      }
      return state;

    case "TEST_GENERATION":
      if (event.type === "TEST_GENERATION_DONE")
        return { ...state, phase: "DETERMINISTIC_CHECKS", testGenerationResults: event.results };
      return state;

    case "DETERMINISTIC_CHECKS":
      if (event.type === "CHECKS_RAN") {
        // M4 owns LLM_REVIEW and ITERATE_OR_SHIP. Transition into LLM_REVIEW on success,
        // ITERATE_OR_SHIP on failure. M4 will pick up from there.
        const allPassed =
          event.result.typecheck.passed &&
          event.result.lint.passed &&
          event.result.tests.passed &&
          event.result.workbooks.every((w) => w.passed);
        const next: Phase = allPassed ? "LLM_REVIEW" : "ITERATE_OR_SHIP";
        return { ...state, phase: next, checksResult: event.result };
      }
      return state;

    // M4
    case "LLM_REVIEW":
      // Always transition to ITERATE_OR_SHIP — that phase's code decides ship vs iterate.
      if (event.type === "REVIEW_RAN")
        return { ...state, phase: "ITERATE_OR_SHIP", reviewResults: event.result };
      return state;

    case "ITERATE_OR_SHIP":
      if (event.type === "ITERATION_NEEDED") {
        // Re-dispatch the affected file contracts. The drive-phase reads
        // `iterationCount` + `iterationHistory` for context; the dispatcher narrows
        // the set of contracts via `targets`.
        return {
          ...state,
          phase: "PARALLEL_IMPLEMENTATION",
          iterationCount: state.iterationCount + 1,
          iterationHistory: [
            ...state.iterationHistory,
            { iteration: state.iterationCount + 1, reason: event.reason, failedFiles: event.targets },
          ],
        };
      }
      if (event.type === "SHIPPED")
        return { ...state, phase: "COMPLETE", shipResult: event.result };
      return state;

    default:
      return state;
  }
}
