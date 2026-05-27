import type { Phase } from "./state.ts";

export interface PhaseConfig {
  model: { provider: string; id: string };
  tools: string[];
}

export const PHASE_CONFIG: Partial<Record<Phase, PhaseConfig>> = {
  RESEARCH: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["ask_user_question", "draft_ptb_research", "bash", "read"],
  },
  APPROACHES: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["draft_ptb_approaches"],
  },
  DESIGN: {
    model: { provider: "github-copilot", id: "claude-opus-4.6" },
    tools: ["draft_ptb_design"],
  },
  PLAN: {
    model: { provider: "github-copilot", id: "claude-sonnet-4.6" },
    tools: ["draft_ptb_plan"],
  },
};
