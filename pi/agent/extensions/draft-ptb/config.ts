import type { Phase } from "./state.ts";

export interface PhaseConfig {
  model: { provider: string; id: string };
  tools: string[];
}

export const PHASE_CONFIG: Partial<Record<Phase, PhaseConfig>> = {
  RESEARCH: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["draft_ptb_understanding", "bash", "read", "ast-grep"],
  },
  COMPLETENESS_CHECK: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["draft_ptb_completeness_check"],
  },
  APPROACHES: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["draft_ptb_approaches"],
  },
  DESIGN: {
    model: { provider: "github-copilot", id: "claude-opus-4.6" },
    tools: ["draft_ptb_spec_with_surface"],
  },
  PLAN: {
    model: { provider: "github-copilot", id: "claude-opus-4.6" },
    tools: ["draft_ptb_plan_with_contracts"],
  },
  // M3 — these phases are driven by code (parallel-dispatcher + deterministic-checks).
  // The PHASE_CONFIG entries document the model the dispatched subagents use; the
  // controller turn (this main agent) does NOT send a prompt during these phases.
  PARALLEL_IMPLEMENTATION: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["bash", "read", "write", "edit", "todowrite", "ask_user_question"],
  },
  TEST_GENERATION: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["bash", "read", "write", "edit", "todowrite", "ask_user_question"],
  },
  DETERMINISTIC_CHECKS: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: [],
  },
  // M4 — both phases are driven by code (review-dispatcher + iterate-or-ship).
  // No controller LLM turn is sent during these phases; the reviewer subagents are
  // spawned as child `pi` processes (one per dimension) with their own models per
  // the contract: opus for contracts, gpt-5.4 for quality, gemini-3.1-pro-preview for tests.
  LLM_REVIEW: {
    model: { provider: "github-copilot", id: "claude-opus-4.6" },
    tools: [],
  },
  ITERATE_OR_SHIP: {
    model: { provider: "github-copilot", id: "claude-opus-4.6" },
    tools: [],
  },
};
