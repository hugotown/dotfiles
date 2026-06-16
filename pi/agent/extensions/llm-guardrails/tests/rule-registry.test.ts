import { describe, expect, mock, test } from "bun:test";
import { createRuleRegistry, validateRule } from "../lib/rule-registry.ts";
import type { EventBus, Rule } from "../lib/types.ts";

const validRule: Rule = {
  id: "no-empty-catch",
  name: "No empty catch",
  filePatterns: ["**/*.ts"],
  patterns: [/catch\s*\([^)]*\)\s*\{\s*\}/g],
  message: "Empty catch blocks hide errors.",
};

describe("validateRule", () => {
  test("accepts a valid rule", () => {
    expect(validateRule(validRule).ok).toBe(true);
  });

  test("rejects invalid metadata", () => {
    expect(validateRule({ ...validRule, id: "" }).ok).toBe(false);
    expect(validateRule({ ...validRule, name: "" }).ok).toBe(false);
    expect(validateRule({ ...validRule, message: "" }).ok).toBe(false);
    expect(validateRule({ ...validRule, filePatterns: [] }).ok).toBe(false);
    expect(validateRule({ ...validRule, filePatterns: ["  "] }).ok).toBe(false);
    expect(validateRule({ ...validRule, patterns: [] }).ok).toBe(false);
    expect(validateRule({ ...validRule, patterns: ["catch"] }).ok).toBe(false);
    expect(validateRule({ ...validRule, severity: "fatal" }).ok).toBe(false);
  });

  test("rejects unsafe regexes", () => {
    expect(validateRule({ ...validRule, patterns: [/(a+)+$/g] }).ok).toBe(false);
  });
});

describe("createRuleRegistry", () => {
  test("registers, overwrites, unregisters, clears, and returns immutable snapshots", () => {
    const warn = mock(() => {});
    const info = mock(() => {});
    const registry = createRuleRegistry({ warn, info });

    expect(registry.register(validRule)).toBe(true);
    expect(registry.getAll()).toHaveLength(1);
    expect(info).toHaveBeenCalledWith("llm-guardrail: rule registered: no-empty-catch");

    const replacement = { ...validRule, name: "Replacement" };
    expect(registry.register(replacement)).toBe(true);
    expect(registry.getAll()[0]?.name).toBe("Replacement");
    expect(info).toHaveBeenCalledWith("llm-guardrail: rule overwritten: no-empty-catch");

    const snapshot = registry.getAll() as Rule[];
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => snapshot.pop()).toThrow();
    expect(registry.getAll()).toHaveLength(1);

    registry.unregister("no-empty-catch");
    expect(registry.getAll()).toEqual([]);
    registry.unregister("missing");
    expect(registry.getAll()).toEqual([]);

    registry.register(validRule);
    registry.clear();
    expect(registry.getAll()).toEqual([]);

    expect(warn).not.toHaveBeenCalled();
  });

  test("invalid rules are rejected and logged", () => {
    const warn = mock(() => {});
    const registry = createRuleRegistry({ warn, info: mock(() => {}) });

    expect(registry.register({ ...validRule, id: "" })).toBe(false);
    expect(registry.getAll()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  test("event bus registration takes effect immediately and catches listener errors", () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const bus: EventBus = { on: (event, handler) => handlers.set(event, handler) };
    const warn = mock(() => {});
    const registry = createRuleRegistry({ warn, info: mock(() => {}) });

    registry.subscribe(bus);
    handlers.get("llm-guardrail:register")?.(validRule);
    expect(registry.getAll().map((rule) => rule.id)).toEqual(["no-empty-catch"]);

    handlers.get("llm-guardrail:register")?.({ nope: true });
    expect(registry.getAll()).toHaveLength(1);
    expect(warn).toHaveBeenCalled();

    const throwingRule = {
      get filePatterns() {
        throw new Error("boom");
      },
    };
    expect(() => handlers.get("llm-guardrail:register")?.(throwingRule)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("llm-guardrail: register listener failed: boom");
  });
});
