// Shared contracts for the obra-sp-flow pipeline. Single source of truth for
// the state machine, the loaded config, and per-phase result shapes.

export type Phase =
  | "IDLE"
  | "BRAINSTORM" // step 1 — interactive design dialogue
  | "PLAN" // step 2 — autonomous plan with research grounding
  | "BRANCH" // step 3 — deterministic isolation branch
  | "IMPLEMENT" // step 4 — parallel file-contract implementation
  | "REVIEW" // step 5 — consolidated code review + fix
  | "VERIFY" // step 6 — deterministic tests/checks
  | "DEBUG" // step 7 — systematic-debugging circuit
  | "FINISH" // step 8 — finishing branch
  | "COMPLETE";

export type Thinking = "low" | "medium" | "high";
export type PhaseKey = "brainstorm" | "plan" | "implement" | "implement_escalate" | "review" | "debug";

export interface PhaseModel {
  provider: string;
  model: string;
  thinking: Thinking;
  /** Per-phase behavioral rules injected only into this phase's prompt. */
  rules: string[];
  /** Per-phase tool allowlist override. Empty => the phase's code default. */
  tools: string[];
}

export interface Config {
  phases: Record<PhaseKey, PhaseModel>;
  limits: {
    implConcurrency: number;
    debugSubcyclesPerError: number;
    debugGlobalCap: number;
    questionArchitectureThreshold: number;
    coverageThreshold: number;
  };
  branch: { prefix: string; base: string };
  finish: { action: "pr" | "merge" | "keep" };
  checks: { typecheck: string; lint: string; test: string };
  skillsDir: string;
}

export interface FileContract {
  path: string;
  purpose: string;
  dependsOn: string[];
}

export type ImplStatus = "DONE" | "DONE_WITH_CONCERNS" | "BLOCKED" | "NEEDS_CONTEXT";

export interface ImplResult {
  path: string;
  status: ImplStatus;
  commit: string | null;
  notes: string;
}

export interface ReviewIssue {
  severity: "critical" | "important" | "minor";
  file: string;
  description: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  /** True when skipped because the tool is not installed (not a failure). */
  skipped?: boolean;
}

export interface ChecksResult {
  results: CheckResult[];
  coverage: number | null;
  passed: boolean;
  failures: string[];
}

export interface FlowState {
  phase: Phase;
  idea: string;
  startedAt: string;
  config: Config;
  intent: string;
  specPath: string | null;
  planPath: string | null;
  fileContracts: FileContract[];
  baseBranch: string;
  featureBranch: string | null;
  hasGit: boolean;
  implResults: ImplResult[];
  reviewIssues: ReviewIssue[];
  checksResult: ChecksResult | null;
  debugBudgets: Record<string, number>;
  debugGlobal: number;
  originalModel: { provider: string; id: string } | null;
  allToolNames: string[];
  escalation: string | null;
  /** Volatile per-phase working data (e.g. brainstorm spec readiness). */
  scratch: Record<string, any>;
}

export type FlowEvent =
  | { type: "START" }
  | { type: "BRAINSTORM_DONE"; specPath: string; intent: string }
  | { type: "PLAN_DONE"; planPath: string; fileContracts: FileContract[] }
  | { type: "BRANCH_READY"; featureBranch: string | null; baseBranch: string; hasGit: boolean }
  | { type: "IMPLEMENT_DONE"; results: ImplResult[] }
  | { type: "REVIEW_DONE"; issues: ReviewIssue[] }
  | { type: "CHECKS_DONE"; result: ChecksResult }
  | { type: "DEBUG_DONE"; budgets: Record<string, number>; globalCount: number }
  | { type: "ESCALATE"; reason: string }
  | { type: "FINISHED" }
  | { type: "RESET" };
