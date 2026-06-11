import { describe, expect, test } from "bun:test";
import {
  PARTITION_SIZE,
  PARTITION_THRESHOLD,
  buildRawFindingsFallback,
  partitionFindings,
  shouldUseMapReduce,
} from "../lib/synthesize.ts";
import type { Finding } from "../types.ts";

function mkFinding(i: number, overrides: Partial<Finding> = {}): Finding {
  return {
    subQuestion: `sub-question ${i}`,
    status: "ok",
    text: `body of finding ${i}`,
    durationMs: 1000 + i * 100,
    ...overrides,
  };
}

describe("shouldUseMapReduce", () => {
  test("returns false at and below threshold", () => {
    expect(shouldUseMapReduce(0)).toBe(false);
    expect(shouldUseMapReduce(PARTITION_THRESHOLD)).toBe(false);
  });

  test("returns true above threshold", () => {
    expect(shouldUseMapReduce(PARTITION_THRESHOLD + 1)).toBe(true);
    expect(shouldUseMapReduce(12)).toBe(true);
  });
});

describe("partitionFindings", () => {
  test("empty array yields no groups", () => {
    expect(partitionFindings([], 4)).toEqual([]);
  });

  test("respects max group size", () => {
    const findings = Array.from({ length: 12 }, (_, i) => mkFinding(i));
    const groups = partitionFindings(findings, 4);
    expect(groups.length).toBe(3);
    for (const g of groups) expect(g.length).toBeLessThanOrEqual(4);
  });

  test("11 findings split into 3 groups of [4,4,3] (size 4)", () => {
    const findings = Array.from({ length: 11 }, (_, i) => mkFinding(i));
    const groups = partitionFindings(findings, 4);
    expect(groups.length).toBe(3);
    const sizes = groups.map((g) => g.length).sort();
    expect(sizes).toEqual([3, 4, 4]);
  });

  test("preserves every finding exactly once", () => {
    const findings = Array.from({ length: 10 }, (_, i) => mkFinding(i));
    const groups = partitionFindings(findings, PARTITION_SIZE);
    const flat = groups.flat();
    expect(flat.length).toBe(10);
    const subs = new Set(flat.map((f) => f.subQuestion));
    expect(subs.size).toBe(10);
  });

  test("round-robin distribution: adjacent findings land in different groups", () => {
    const findings = Array.from({ length: 6 }, (_, i) => mkFinding(i));
    const groups = partitionFindings(findings, 4);
    // Round-robin with 2 groups means group[0] = [f0, f2, f4], group[1] = [f1, f3, f5]
    expect(groups.length).toBe(2);
    expect(groups[0].map((f) => f.subQuestion)).toEqual(["sub-question 0", "sub-question 2", "sub-question 4"]);
    expect(groups[1].map((f) => f.subQuestion)).toEqual(["sub-question 1", "sub-question 3", "sub-question 5"]);
  });

  test("throws on non-positive size", () => {
    expect(() => partitionFindings([mkFinding(0)], 0)).toThrow();
    expect(() => partitionFindings([mkFinding(0)], -1)).toThrow();
  });
});

describe("buildRawFindingsFallback", () => {
  test("includes pregunta, health summary, and every finding's body", () => {
    const findings = [
      mkFinding(1),
      mkFinding(2, { status: "ok", partial: true, text: "partial body" }),
      mkFinding(3, { status: "timeout", text: "", errorMessage: "timed out" }),
    ];
    const out = buildRawFindingsFallback({
      pregunta: "test question",
      findings,
      reason: "synthesizer crashed",
    });
    expect(out).toContain("test question");
    expect(out).toContain("synthesizer crashed");
    expect(out).toContain("MAP HEALTH:");
    expect(out).toContain("sub-question 1");
    expect(out).toContain("body of finding 1");
    expect(out).toContain("partial body");
    expect(out).toContain("partial"); // tag rendered
    expect(out).toContain("timed out"); // error from finding 3
  });

  test("renders empty-text finding without crashing", () => {
    const out = buildRawFindingsFallback({
      pregunta: "q",
      findings: [mkFinding(1, { text: "", errorMessage: undefined })],
      reason: "x",
    });
    expect(out).toContain("Sin texto recuperable");
  });

  test("starts with a fallback header so callers can detect this mode", () => {
    const out = buildRawFindingsFallback({
      pregunta: "q",
      findings: [mkFinding(1)],
      reason: "x",
    });
    expect(out.startsWith("# Reporte de investigación (fallback sin síntesis)")).toBe(true);
  });
});
