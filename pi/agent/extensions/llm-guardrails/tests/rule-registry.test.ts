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

  test("rejects regex validation that takes longer than 50ms", () => {
    const originalNow = performance.now;
    const now = mock(() => 0);
    now.mockReturnValueOnce(0);
    now.mockReturnValueOnce(51);
    Object.defineProperty(performance, "now", { configurable: true, value: now });

    try {
      const result = validateRule(validRule);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("timed out");
    } finally {
      Object.defineProperty(performance, "now", { configurable: true, value: originalNow });
    }
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

    expect(registry.register({ ...validRule, patterns: ["catch"], id: "bad-rule" })).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("bad-rule"));
  });

  test("registered rules are isolated from original object mutation", () => {
    const registry = createRuleRegistry({ warn: mock(() => {}), info: mock(() => {}) });
    const rule = {
      ...validRule,
      filePatterns: [...validRule.filePatterns],
      patterns: [...validRule.patterns],
    };

    expect(registry.register(rule)).toBe(true);
    rule.name = "Mutated";
    rule.filePatterns.push("**/*.js");
    rule.patterns.push(/mutated/g);

    const [stored] = registry.getAll();
    expect(stored?.name).toBe("No empty catch");
    expect(stored?.filePatterns).toEqual(["**/*.ts"]);
    expect(stored?.patterns).toHaveLength(1);
  });

  test("returned rules and nested arrays cannot mutate registry state", () => {
    const registry = createRuleRegistry({ warn: mock(() => {}), info: mock(() => {}) });

    expect(registry.register(validRule)).toBe(true);
    const [returned] = registry.getAll() as Rule[];

    expect(Object.isFrozen(returned)).toBe(true);
    expect(Object.isFrozen(returned?.filePatterns)).toBe(true);
    expect(Object.isFrozen(returned?.patterns)).toBe(true);
    expect(() => {
      if (returned) (returned as { name: string }).name = "Mutated";
    }).toThrow();
    expect(() => {
      if (returned) (returned.filePatterns as string[]).push("**/*.js");
    }).toThrow();
    expect(() => {
      if (returned) (returned.patterns as RegExp[]).push(/mutated/g);
    }).toThrow();

    const [stored] = registry.getAll();
    expect(stored?.name).toBe("No empty catch");
    expect(stored?.filePatterns).toEqual(["**/*.ts"]);
    expect(stored?.patterns).toHaveLength(1);
  });

  test("event bus registration takes effect immediately and catches listener errors", () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const bus: EventBus = {
      on: (event, handler) => {
        handlers.set(event, handler);
      },
    };
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

  test("subscribe returns an unsubscribe function that removes the listener", () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const remove = mock(() => handlers.delete("llm-guardrail:register"));
    const bus: EventBus = {
      on: (event, handler) => {
        handlers.set(event, handler);
        return remove;
      },
    };
    const registry = createRuleRegistry({ warn: mock(() => {}), info: mock(() => {}) });

    const unsubscribe = registry.subscribe(bus);
    handlers.get("llm-guardrail:register")?.(validRule);
    expect(registry.getAll()).toHaveLength(1);

    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
    handlers.get("llm-guardrail:register")?.({ ...validRule, id: "after-unsubscribe" });
    expect(registry.getAll().map((rule) => rule.id)).toEqual(["no-empty-catch"]);
  });
});
