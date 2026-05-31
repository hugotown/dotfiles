// Reducers for late phases: DESIGN, PLAN, PARALLEL_IMPLEMENTATION, TEST_GENERATION,
// DETERMINISTIC_CHECKS, LLM_REVIEW, ITERATE_OR_SHIP.

import type { DraftState, DraftEvent, Phase } from "./state.ts";

export function reduceLatePhases(state: DraftState, event: DraftEvent): DraftState | null {
  switch (state.phase) {
    case "DESIGN":
      if (event.type === "SPEC_RECEIVED") return { ...state, specTitle: event.title, spec: event.spec };
      if (event.type === "TEST_SURFACE_RECEIVED") return { ...state, testSurface: event.testSurface };
      if (event.type === "SPEC_APPROVED") return { ...state, phase: "PLAN", specPath: event.specPath };
      if (event.type === "SPEC_REVISION_REQUESTED") return { ...state, revisionFeedback: event.feedback };
      return state;

    case "PLAN":
      if (event.type === "PLAN_RECEIVED") return { ...state, plan: event.plan };
      if (event.type === "CONTRACTS_RECEIVED") return { ...state, fileContracts: event.fileContracts, sharedFiles: event.sharedFiles, infraTask: event.infraTask, testContracts: event.testContracts };
      if (event.type === "PLAN_SAVED") {
        const next: Phase = state.fileContracts.length > 0 ? "PARALLEL_IMPLEMENTATION" : "COMPLETE";
        return { ...state, phase: next, planPath: event.planPath };
      }
      return state;

    case "PARALLEL_IMPLEMENTATION":
      if (event.type === "IMPLEMENTATION_DONE") {
        const next: Phase = state.testContracts.length > 0 ? "TEST_GENERATION" : "DETERMINISTIC_CHECKS";
        return { ...state, phase: next, implementationResults: event.results };
      }
      return state;

    case "TEST_GENERATION":
      if (event.type === "TEST_GENERATION_DONE") return { ...state, phase: "DETERMINISTIC_CHECKS", testGenerationResults: event.results };
      return state;

    case "DETERMINISTIC_CHECKS":
      if (event.type === "CHECKS_RAN") {
        const allPassed = event.result.typecheck.passed && event.result.lint.passed && event.result.tests.passed && event.result.workbooks.every((w) => w.passed);
        return { ...state, phase: allPassed ? "LLM_REVIEW" : "ITERATE_OR_SHIP", checksResult: event.result };
      }
      return state;

    case "LLM_REVIEW":
      if (event.type === "REVIEW_RAN") return { ...state, phase: "ITERATE_OR_SHIP", reviewResults: event.result };
      return state;

    case "ITERATE_OR_SHIP":
      if (event.type === "ITERATION_NEEDED") {
        return {
          ...state, phase: "PARALLEL_IMPLEMENTATION", iterationCount: state.iterationCount + 1,
          iterationHistory: [...state.iterationHistory, { iteration: state.iterationCount + 1, reason: event.reason, failedFiles: event.targets }],
        };
      }
      if (event.type === "SHIPPED") return { ...state, phase: "COMPLETE", shipResult: event.result };
      return state;

    default:
      return null;
  }
}
