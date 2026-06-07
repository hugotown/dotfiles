// Public type contracts for the investigate extension. Imported by lib/schema.ts,
// lib/depth-config.ts, lib/plan.ts, lib/investigator.ts, lib/synthesize.ts, index.ts.

export type DepthLevel = "light" | "medium" | "high" | "deep";
export type ThinkingLevel = "low" | "medium" | "high";
export type FreshnessLevel = "any" | "day" | "week" | "month" | "year";

export interface RoleSpec {
  provider: string;
  model: string;
}

export interface DepthProfile {
  sub_questions: number;
  curls_per_subpi: number;
  concurrency_limit: number;
  thinking: ThinkingLevel;
  subpi_timeout_ms: number;
  planner: RoleSpec;
  investigator: RoleSpec;
  synthesizer: RoleSpec;
}

export interface InvestigateLimits {
  max_subpi_text_kb: number;
  max_synthesizer_tokens: number;
  max_planner_tokens: number;
}

export interface BashGuardConfig {
  enabled: boolean;
  block_commands: string[];
}

export interface InvestigateConfig {
  defaults: { freshness: FreshnessLevel };
  depths: Record<DepthLevel, DepthProfile>;
  limits: InvestigateLimits;
  bash_guard: BashGuardConfig;
}

export interface InvestigateInput {
  pregunta: string;
  depth: DepthLevel;
  freshness?: FreshnessLevel;
}

/** One sub-pi investigator's outcome. Stored by lib/investigator.ts, consumed by lib/synthesize.ts. */
export interface Finding {
  subQuestion: string;
  status: "ok" | "timeout" | "missing_findings" | "error";
  text: string;
  errorMessage?: string;
  exitCode?: number;
  durationMs: number;
}

export class MissingProxyEnvError extends Error {
  constructor(missing: string[]) {
    super(`investigate requires proxy env vars: missing ${missing.join(", ")}. The investigator sub-pi calls curl which would fail proxy enforcement.`);
    this.name = "MissingProxyEnvError";
  }
}

export class PlannerOutputError extends Error {
  constructor(reason: string, raw: string) {
    super(`Planner output invalid: ${reason}. Raw: ${raw.slice(0, 300)}`);
    this.name = "PlannerOutputError";
  }
}

export class SynthesizerError extends Error {
  constructor(reason: string) {
    super(`Synthesizer failed: ${reason}`);
    this.name = "SynthesizerError";
  }
}
