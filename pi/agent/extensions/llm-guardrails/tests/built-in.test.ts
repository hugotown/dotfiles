import { describe, expect, test } from "bun:test";
import safeRegex from "safe-regex";
import { BUILT_IN_RULES } from "../rules/built-in.ts";

const getRule = (id: string) => {
  const rule = BUILT_IN_RULES.find((candidate) => candidate.id === id);
  expect(rule).toBeDefined();
  return rule!;
};

const matchesAnyPattern = (patterns: ReadonlyArray<RegExp>, content: string) =>
  patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });

describe("BUILT_IN_RULES", () => {
  test("each rule has a unique id and usable metadata", () => {
    const ids = new Set<string>();
    for (const rule of BUILT_IN_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.filePatterns.length).toBeGreaterThan(0);
      expect(rule.patterns.length).toBeGreaterThan(0);
      expect(rule.message.length).toBeGreaterThan(0);
    }
  });

  test("all built-in regexes are global and case-insensitive", () => {
    for (const rule of BUILT_IN_RULES) {
      for (const pattern of rule.patterns) {
        expect(pattern.flags).toContain("g");
        expect(pattern.flags).toContain("i");
      }
    }
  });

  test("all built-in regexes are safe-regex compatible", () => {
    for (const rule of BUILT_IN_RULES) {
      for (const pattern of rule.patterns) {
        expect(safeRegex(pattern)).toBe(true);
      }
    }
  });

  test("linter patterns match representative eslint suppressions", () => {
    const rule = getRule("no-linter-suppressions");
    const matches = (content: string) => matchesAnyPattern(rule.patterns, content);

    expect(matches("// eslint-disable-next-line react-hooks/exhaustive-deps")).toBe(true);
    expect(matches("// eslint-disable-line no-console")).toBe(true);
    expect(matches("/* eslint-disable @typescript-eslint/no-explicit-any */")).toBe(true);
    expect(matches("@phpstan-ignore-line")).toBe(true);
    expect(matches("@psalm-suppress PropertyNotSetInConstructor")).toBe(true);
    expect(matches("// I disabled the lint warning")).toBe(false);
  });

  test("compiler patterns match Java SuppressWarnings annotations", () => {
    const rule = getRule("no-compiler-suppressions");
    const matches = (content: string) => matchesAnyPattern(rule.patterns, content);

    expect(matches('@SuppressWarnings("unchecked")')).toBe(true);
    expect(matches('// @SuppressWarnings("unchecked")')).toBe(true);
  });

  test("exports the four suppression rule groups", () => {
    expect(BUILT_IN_RULES.map((rule) => rule.id)).toEqual([
      "no-linter-suppressions",
      "no-type-suppressions",
      "no-runtime-suppressions",
      "no-compiler-suppressions",
    ]);
  });
});
