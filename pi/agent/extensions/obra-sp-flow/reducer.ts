// Pure state machine for the 8-phase pipeline. No side effects: drive functions
// compute the next event, this reducer applies it. Order:
// BRAINSTORM -> PLAN -> BRANCH -> IMPLEMENT -> REVIEW -> VERIFY
//   -> (DEBUG loop while checks fail) -> FINISH -> COMPLETE.

import type { Config, FlowEvent, FlowState } from "./types.ts";

export function createInitialState(idea: string, config: Config): FlowState {
  return {
    phase: "IDLE",
    idea,
    startedAt: new Date().toISOString(),
    config,
    intent: "",
    specPath: null,
    planPath: null,
    fileContracts: [],
    baseBranch: config.branch.base,
    featureBranch: null,
    hasGit: false,
    implResults: [],
    reviewIssues: [],
    checksResult: null,
    debugBudgets: {},
    debugGlobal: 0,
    originalModel: null,
    allToolNames: [],
    escalation: null,
    scratch: {},
  };
}

export function transition(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "START":
      return { ...state, phase: "BRAINSTORM" };
    case "BRAINSTORM_DONE":
      return { ...state, phase: "PLAN", specPath: event.specPath, intent: event.intent };
    case "PLAN_DONE":
      return { ...state, phase: "BRANCH", planPath: event.planPath, fileContracts: event.fileContracts };
    case "BRANCH_READY":
      return { ...state, phase: "IMPLEMENT", featureBranch: event.featureBranch, baseBranch: event.baseBranch, hasGit: event.hasGit };
    case "IMPLEMENT_DONE":
      return { ...state, phase: "REVIEW", implResults: event.results };
    case "REVIEW_DONE":
      return { ...state, phase: "VERIFY", reviewIssues: event.issues };
    case "CHECKS_DONE":
      return { ...state, phase: event.result.passed ? "FINISH" : "DEBUG", checksResult: event.result };
    case "DEBUG_DONE":
      return { ...state, phase: "VERIFY", debugBudgets: event.budgets, debugGlobal: event.globalCount };
    case "ESCALATE":
      return { ...state, phase: "COMPLETE", escalation: event.reason };
    case "FINISHED":
      return { ...state, phase: "COMPLETE" };
    case "RESET":
      return { ...state, phase: "IDLE" };
  }
}
