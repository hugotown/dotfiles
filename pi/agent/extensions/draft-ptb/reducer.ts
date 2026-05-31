// State machine — composes early + late phase reducers.

import type { DraftState, DraftEvent, Understanding, GitInfo, ProjectInfo } from "./state.ts";
import { reduceEarlyPhases } from "./reducer-early.ts";
import { reduceLatePhases } from "./reducer-late.ts";

const EMPTY_GIT: GitInfo = { hasGit: false, baseBranch: null, snapshotSha: null, currentBranch: null, featureBranch: null };
const EMPTY_PROJECT: ProjectInfo = { manifests: [], types: [], isMonorepo: false, workspaces: [], hasPlaywright: false, hasCypress: false, testFolders: { e2e: "", integration: "" }, obsidianPath: "" };
const EMPTY_UNDERSTANDING: Understanding = {
  userStory: { when: "", given: "", then: "" }, why: "", value: "", risks: [],
  existingSolutions: "", reusableComponents: "", assumptions: [], nonGoals: [],
  scopeCheck: { isDecomposable: false, subProjects: [] },
  testRequirements: { wantsE2E: false, wantsIntegration: false, fields: [], functionalRequirements: [], businessRules: [] },
};

export function createInitialState(idea: string): DraftState {
  return {
    phase: "IDLE", idea, featureFolder: "", startedAt: "", compressedContext: "",
    questions: [], answers: [], brainstormingPath: null, approaches: [], recommendation: "",
    chosenApproach: null, specTitle: "", spec: "", specPath: null, revisionFeedback: "",
    plan: "", planPath: null, originalModel: null, allToolNames: [],
    gitInfo: EMPTY_GIT, projectInfo: EMPTY_PROJECT, understanding: EMPTY_UNDERSTANDING,
    completenessIterations: 0, completenessResult: null,
    testSurface: null, fileContracts: [], sharedFiles: [], infraTask: null, testContracts: [],
    implementationResults: [], testGenerationResults: [], checksResult: null,
    reviewResults: null, iterationCount: 0, shipResult: null, iterationHistory: [],
  };
}

export function transition(state: DraftState, event: DraftEvent): DraftState {
  if (event.type === "RESET") return { ...state, phase: "IDLE" };
  return reduceEarlyPhases(state, event) ?? reduceLatePhases(state, event) ?? state;
}
