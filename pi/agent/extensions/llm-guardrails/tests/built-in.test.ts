import { describe, expect, test } from "bun:test";
import { BUILT_IN_RULES } from "../rules/built-in.ts";

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

  test("exports the four suppression rule groups", () => {
    expect(BUILT_IN_RULES.map((rule) => rule.id)).toEqual([
      "no-linter-suppressions",
      "no-type-suppressions",
      "no-runtime-suppressions",
      "no-compiler-suppressions",
    ]);
  });
});
