import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { deepResolve, isEnvRef, resolveValue } from "./env-resolver.ts";
import { validateRule } from "./rule-registry.ts";
import type { Config, Mode, Rule } from "./types.ts";

export { resolveValue };

type Raw = Record<string, unknown>;

interface Logger {
  warn(message: string): void;
}

const BUILT_IN_RULE_IDS = [
  "no-linter-suppressions",
  "no-type-suppressions",
  "no-runtime-suppressions",
  "no-compiler-suppressions",
] as const;

function freezeRule(rule: Rule): Rule {
  return Object.freeze({
    ...rule,
    filePatterns: Object.freeze([...rule.filePatterns]),
    patterns: Object.freeze(rule.patterns.map((pattern) => Object.freeze(new RegExp(pattern.source, pattern.flags)))),
  });
}

export const DEFAULT_CONFIG: Config = Object.freeze({
  mode: "warn",
  watch: Object.freeze({
    include: Object.freeze(["**/*"]),
    ignore: Object.freeze([]),
    maxSizeKb: 500,
  }),
  debounceMs: 200,
  cooldownMs: 30_000,
  builtInRules: Object.freeze({
    "no-linter-suppressions": true,
    "no-type-suppressions": true,
    "no-runtime-suppressions": true,
    "no-compiler-suppressions": true,
  }),
  customRules: Object.freeze([]),
});

function asRaw(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function warnInvalid(field: string, logger: Logger): void {
  logger.warn(`llm-guardrail: invalid config field ${field}; using default`);
}

function readMode(raw: unknown, logger: Logger): Mode {
  if (raw === "warn" || raw === "strict" || raw === "off") return raw;
  if (raw !== undefined) warnInvalid("mode", logger);
  return DEFAULT_CONFIG.mode;
}

function readNumber(raw: unknown, fallback: number, field: string, logger: Logger): number {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;

  if (!Number.isFinite(value) || value < 0) {
    if (raw !== undefined) warnInvalid(field, logger);
    return fallback;
  }

  return value;
}

function readStrings(raw: unknown, fallback: readonly string[], field: string, logger: Logger): readonly string[] {
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string" || value.length === 0 || isEnvRef(value))) {
    if (raw !== undefined) warnInvalid(field, logger);
    return fallback;
  }

  return Object.freeze([...raw]);
}

function readBuiltInToggle(raw: unknown, id: string, fallback: boolean, logger: Logger): boolean {
  if (typeof raw === "boolean") return raw;

  if (typeof raw === "string") {
    const normalized = raw.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  logger.warn(`llm-guardrail: invalid built-in toggle for ${id}; using default`);
  return fallback;
}

function readBuiltInRules(raw: unknown, logger: Logger): Readonly<Record<string, boolean>> {
  const output: Record<string, boolean> = { ...DEFAULT_CONFIG.builtInRules };
  const entries = asRaw(raw);

  for (const [id, value] of Object.entries(entries)) {
    if (!BUILT_IN_RULE_IDS.includes(id as (typeof BUILT_IN_RULE_IDS)[number])) {
      logger.warn(`llm-guardrail: unknown built-in rule ignored: ${id}`);
      continue;
    }

    output[id] = readBuiltInToggle(value, id, output[id] ?? true, logger);
  }

  return Object.freeze(output);
}

function toRegexes(raw: unknown, logger: Logger): RegExp[] | undefined {
  if (!Array.isArray(raw)) return [];

  const patterns: RegExp[] = [];
  for (const pattern of raw) {
    if (typeof pattern !== "string") {
      logger.warn("llm-guardrail: custom rule skipped: patterns must contain only strings");
      return undefined;
    }

    if (isEnvRef(pattern)) {
      logger.warn(`llm-guardrail: custom rule skipped: unresolved env ref ${pattern}`);
      return undefined;
    }

    try {
      patterns.push(new RegExp(pattern, "gi"));
    } catch (error) {
      logger.warn(`llm-guardrail: invalid custom rule regex skipped: ${(error as Error).message}`);
      return undefined;
    }
  }

  return patterns;
}

function readRequiredString(candidate: Raw, field: string, logger: Logger): string | undefined {
  const value = candidate[field];
  if (typeof value !== "string") {
    logger.warn(`llm-guardrail: custom rule skipped: ${field} must be a string`);
    return undefined;
  }

  if (isEnvRef(value)) {
    logger.warn(`llm-guardrail: custom rule skipped: unresolved env ref ${value}`);
    return undefined;
  }

  return value;
}

function readRuleFilePatterns(candidate: Raw, logger: Logger): readonly string[] | undefined {
  const value = candidate.filePatterns;
  if (!Array.isArray(value)) return [];

  if (value.some((pattern) => typeof pattern !== "string")) {
    logger.warn("llm-guardrail: custom rule skipped: filePatterns must contain only strings");
    return undefined;
  }

  if (value.some(isEnvRef)) {
    logger.warn("llm-guardrail: custom rule skipped: unresolved env ref in filePatterns");
    return undefined;
  }

  return value;
}

function readCustomRules(raw: unknown, logger: Logger): readonly Rule[] {
  if (raw === undefined) return DEFAULT_CONFIG.customRules;
  if (!Array.isArray(raw)) {
    warnInvalid("custom_rules", logger);
    return DEFAULT_CONFIG.customRules;
  }

  const rules: Rule[] = [];
  for (const entry of raw) {
    const candidate = asRaw(entry);
    const id = readRequiredString(candidate, "id", logger);
    const name = readRequiredString(candidate, "name", logger);
    const message = readRequiredString(candidate, "message", logger);
    const filePatterns = readRuleFilePatterns(candidate, logger);
    const patterns = toRegexes(candidate.patterns, logger);
    if (id === undefined || name === undefined || message === undefined || filePatterns === undefined || !patterns) continue;

    if (BUILT_IN_RULE_IDS.includes(id as (typeof BUILT_IN_RULE_IDS)[number])) {
      logger.warn(`llm-guardrail: custom rule ${id} overrides built-in rule`);
    }

    const rule: Rule = {
      id,
      name,
      description: typeof candidate.description === "string" ? candidate.description : undefined,
      filePatterns,
      patterns,
      message,
      severity: candidate.severity === "error" || candidate.severity === "warning" ? candidate.severity : undefined,
    };
    const result = validateRule(rule);

    if (result.ok) rules.push(freezeRule(rule));
    else logger.warn(`llm-guardrail: custom rule skipped: ${result.reason}`);
  }

  return Object.freeze(rules);
}

export function parseConfig(yamlText: string, logger: Logger = console): Config {
  let raw: Raw;

  try {
    raw = asRaw(deepResolve(parseYaml(yamlText) ?? {}));
  } catch (error) {
    logger.warn(`llm-guardrail: invalid YAML; using default config: ${(error as Error).message}`);
    return DEFAULT_CONFIG;
  }

  const watch = asRaw(raw.watch);

  return Object.freeze({
    mode: readMode(raw.mode, logger),
    watch: Object.freeze({
      include: readStrings(watch.include, DEFAULT_CONFIG.watch.include, "watch.include", logger),
      ignore: readStrings(watch.ignore, DEFAULT_CONFIG.watch.ignore, "watch.ignore", logger),
      maxSizeKb: readNumber(watch.max_size_kb, DEFAULT_CONFIG.watch.maxSizeKb, "watch.max_size_kb", logger),
    }),
    debounceMs: readNumber(raw.debounce_ms, DEFAULT_CONFIG.debounceMs, "debounce_ms", logger),
    cooldownMs: readNumber(raw.cooldown_ms, DEFAULT_CONFIG.cooldownMs, "cooldown_ms", logger),
    builtInRules: readBuiltInRules(raw.built_in_rules, logger),
    customRules: readCustomRules(raw.custom_rules, logger),
  });
}

export function configPath(): string {
  return fileURLToPath(new URL("../config.yml", import.meta.url));
}

export function loadConfig(path = configPath(), logger: Logger = console): Config {
  if (!fs.existsSync(path)) return DEFAULT_CONFIG;

  return parseConfig(fs.readFileSync(path, "utf8"), logger);
}
