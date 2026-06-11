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
  /** Number of retry attempts for an investigator sub-pi that times out OR returns no FINDINGS marker (0 = no retry). Each retry uses timeout * 1.5. */
  investigator_max_retries: number;
  /** Hard timeout (ms) for ONE synthesizer call (single synth in small runs, or each map-reduce step in large runs). Independent of subpi_timeout_ms. */
  synth_timeout_ms: number;
  /** Wall-clock budget (ms) for the WHOLE investigate run (plan + map + reduce). When exceeded the run aborts and returns whatever findings were collected. */
  wall_clock_budget_ms: number;
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
  /** True when the sub-pi was killed (timeout or non-zero exit) but partial FINDINGS were recovered. */
  partial?: boolean;
  /** How many retry attempts were spent on this sub-pi (0 = first try succeeded or only one try). */
  attempts?: number;
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
