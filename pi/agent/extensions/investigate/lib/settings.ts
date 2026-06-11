import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type {
  BashGuardConfig,
  DepthLevel,
  DepthProfile,
  FreshnessLevel,
  InvestigateConfig,
  InvestigateLimits,
  RoleSpec,
  ThinkingLevel,
} from "../types.ts";

const ENV_REF = /^\$([A-Z_][A-Z0-9_]*)(?::(.*))?$/s;
const DEPTHS: DepthLevel[] = ["light", "medium", "high", "deep"];
const THINKING: ThinkingLevel[] = ["low", "medium", "high"];
const FRESHNESS: FreshnessLevel[] = ["any", "day", "week", "month", "year"];

export function resolveValue<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  const m = value.match(ENV_REF);
  if (!m) return value;
  const [, name, fallback] = m;
  const fromEnv = process.env[name];
  if (fromEnv !== undefined) return fromEnv;
  if (fallback !== undefined) return fallback;
  return value;
}

function coerceNumber(field: string, raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Config field "${field}": expected a positive number, got ${JSON.stringify(raw)}.`);
    return n;
  }
  throw new Error(`Config field "${field}": expected a number, got ${typeof raw}.`);
}
function coerceNonNegativeInt(field: string, raw: unknown): number {
  // Accepts 0; used for retry counters where 0 means "no retries".
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) throw new Error(`Config field "${field}": expected a non-negative integer, got ${JSON.stringify(raw)}.`);
    return n;
  }
  throw new Error(`Config field "${field}": expected a non-negative integer, got ${typeof raw}.`);
}
function coerceBoolean(field: string, raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
    const s = raw.toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  throw new Error(`Config field "${field}": expected "true" or "false", got ${JSON.stringify(raw)}.`);
}
function coerceString(field: string, raw: unknown): string {
  if (typeof raw !== "string") throw new Error(`Config field "${field}": expected a string, got ${typeof raw}.`);
  if (raw.startsWith("$")) throw new Error(`Config field "${field}": unresolved env reference ${raw}.`);
  if (raw.length === 0) throw new Error(`Config field "${field}": expected non-empty string.`);
  return raw;
}
function coerceEnum<T extends string>(field: string, raw: unknown, allowed: T[]): T {
  const s = coerceString(field, raw);
  if (!allowed.includes(s as T)) throw new Error(`Config field "${field}": expected one of ${allowed.join("|")}, got "${s}".`);
  return s as T;
}

function deepResolve(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepResolve);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepResolve(v);
    return out;
  }
  return resolveValue(value as never);
}

function validateRole(field: string, raw: unknown): RoleSpec {
  const r = raw as Record<string, unknown>;
  return { provider: coerceString(`${field}.provider`, r?.provider), model: coerceString(`${field}.model`, r?.model) };
}

function validateDepth(field: string, raw: unknown): DepthProfile {
  const r = raw as Record<string, unknown>;
  if (!r) throw new Error(`Config field "${field}": missing.`);
  const subpiTimeout = coerceNumber(`${field}.subpi_timeout_ms`, r.subpi_timeout_ms);
  return {
    sub_questions: coerceNumber(`${field}.sub_questions`, r.sub_questions),
    curls_per_subpi: coerceNumber(`${field}.curls_per_subpi`, r.curls_per_subpi),
    concurrency_limit: coerceNumber(`${field}.concurrency_limit`, r.concurrency_limit),
    thinking: coerceEnum(`${field}.thinking`, r.thinking, THINKING),
    subpi_timeout_ms: subpiTimeout,
    // Defaults below preserve back-compat with configs that predate these fields.
    investigator_max_retries: r.investigator_max_retries === undefined
      ? 1
      : coerceNonNegativeInt(`${field}.investigator_max_retries`, r.investigator_max_retries),
    // synth_timeout_ms defaults to subpi_timeout_ms when omitted (legacy behaviour).
    synth_timeout_ms: r.synth_timeout_ms === undefined
      ? subpiTimeout
      : coerceNumber(`${field}.synth_timeout_ms`, r.synth_timeout_ms),
    // wall_clock_budget_ms defaults to 10 minutes when omitted — a sane upper bound that prevents hangs.
    wall_clock_budget_ms: r.wall_clock_budget_ms === undefined
      ? 600_000
      : coerceNumber(`${field}.wall_clock_budget_ms`, r.wall_clock_budget_ms),
    planner: validateRole(`${field}.planner`, r.planner),
    investigator: validateRole(`${field}.investigator`, r.investigator),
    synthesizer: validateRole(`${field}.synthesizer`, r.synthesizer),
  };
}

function validateLimits(raw: unknown): InvestigateLimits {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    max_subpi_text_kb: coerceNumber("limits.max_subpi_text_kb", r.max_subpi_text_kb),
    max_synthesizer_tokens: coerceNumber("limits.max_synthesizer_tokens", r.max_synthesizer_tokens),
    max_planner_tokens: coerceNumber("limits.max_planner_tokens", r.max_planner_tokens),
  };
}

function validateBashGuard(raw: unknown): BashGuardConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cmds = r.block_commands;
  if (!Array.isArray(cmds)) throw new Error('Config field "bash_guard.block_commands": expected array.');
  return {
    enabled: coerceBoolean("bash_guard.enabled", r.enabled),
    block_commands: cmds.map((c, i) => coerceString(`bash_guard.block_commands[${i}]`, c)),
  };
}

export function validateConfig(raw: unknown): InvestigateConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const defaults = (r.defaults ?? {}) as Record<string, unknown>;
  const depths = (r.depths ?? {}) as Record<string, unknown>;
  const validated: Record<DepthLevel, DepthProfile> = {} as never;
  for (const d of DEPTHS) validated[d] = validateDepth(`depths.${d}`, depths[d]);
  return {
    defaults: { freshness: coerceEnum("defaults.freshness", defaults.freshness, FRESHNESS) },
    depths: validated,
    limits: validateLimits(r.limits),
    bash_guard: validateBashGuard(r.bash_guard),
  };
}

export function parseConfig(yamlText: string): InvestigateConfig {
  const raw = parseYaml(yamlText) ?? {};
  return validateConfig(deepResolve(raw));
}

let cached: InvestigateConfig | null = null;
export function getConfig(): InvestigateConfig {
  if (cached) return cached;
  const path = fileURLToPath(new URL("../config.yml", import.meta.url));
  cached = parseConfig(fs.readFileSync(path, "utf-8"));
  return cached;
}

export function _resetConfigCache(): void { cached = null; }
