import safeRegex from "safe-regex";
import type { EventBus, Rule } from "./types.ts";

interface Logger {
  warn(message: string): void;
  info(message: string): void;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const SAFE_REGEX_TIMEOUT_MS = 50;

function isRuleShape(value: unknown): value is Partial<Rule> & Pick<Rule, "filePatterns" | "patterns"> {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<Rule>;

  return Array.isArray(rule.filePatterns) && Array.isArray(rule.patterns);
}

export function validateRule(value: unknown): ValidationResult {
  if (!isRuleShape(value)) return { ok: false, reason: "rule must be an object with filePatterns and patterns arrays" };

  if (typeof value.id !== "string" || value.id.trim().length === 0) return { ok: false, reason: "rule id must be non-empty" };
  if (typeof value.name !== "string" || value.name.trim().length === 0) return { ok: false, reason: "rule name must be non-empty" };
  if (typeof value.message !== "string" || value.message.trim().length === 0) return { ok: false, reason: "rule message must be non-empty" };

  if (value.filePatterns.length === 0 || value.filePatterns.some((pattern) => typeof pattern !== "string" || pattern.trim().length === 0)) {
    return { ok: false, reason: "rule filePatterns must contain at least one non-empty string" };
  }

  if (value.patterns.length === 0 || value.patterns.some((pattern) => !(pattern instanceof RegExp))) {
    return { ok: false, reason: "rule patterns must contain at least one RegExp" };
  }

  for (const pattern of value.patterns) {
    const started = performance.now();
    const isSafe = safeRegex(pattern);
    const durationMs = performance.now() - started;

    if (durationMs > SAFE_REGEX_TIMEOUT_MS) return { ok: false, reason: "rule regex validation timed out" };
    if (!isSafe) return { ok: false, reason: "rule contains an unsafe regex" };
  }

  if (value.severity !== undefined && value.severity !== "error" && value.severity !== "warning") {
    return { ok: false, reason: "rule severity must be error or warning" };
  }

  return { ok: true };
}

function ruleIdForLog(rule: unknown): string | undefined {
  if (!rule || typeof rule !== "object") return undefined;
  const id = (rule as { id?: unknown }).id;

  return typeof id === "string" && id.trim().length > 0 ? id : undefined;
}

function freezeRule(rule: Rule): Rule {
  const filePatterns = Object.freeze([...rule.filePatterns]);
  const patterns = Object.freeze(rule.patterns.map((pattern) => Object.freeze(new RegExp(pattern.source, pattern.flags))));

  return Object.freeze({
    ...rule,
    filePatterns,
    patterns,
  });
}

export function createRuleRegistry(logger: Logger) {
  const rules = new Map<string, Rule>();

  function register(rule: unknown): boolean {
    const result = validateRule(rule);
    if (!result.ok) {
      const id = ruleIdForLog(rule);
      logger.warn(`llm-guardrail: invalid rule skipped${id ? `: ${id}` : ""}: ${result.reason}`);
      return false;
    }

    const typedRule = freezeRule(rule as Rule);
    const existed = rules.has(typedRule.id);
    rules.set(typedRule.id, typedRule);
    logger.info(`llm-guardrail: rule ${existed ? "overwritten" : "registered"}: ${typedRule.id}`);
    return true;
  }

  function unregister(id: string): void {
    rules.delete(id);
  }

  function getAll(): readonly Rule[] {
    return Object.freeze([...rules.values()]);
  }

  function clear(): void {
    rules.clear();
  }

  function subscribe(bus: EventBus): void {
    bus.on("llm-guardrail:register", (rule) => {
      try {
        register(rule);
      } catch (error) {
        logger.warn(`llm-guardrail: register listener failed: ${(error as Error).message}`);
      }
    });
  }

  return { register, unregister, getAll, clear, subscribe };
}
