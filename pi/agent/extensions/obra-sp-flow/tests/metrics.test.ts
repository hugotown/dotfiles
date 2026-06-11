import { describe, expect, test } from "bun:test";
import { addUsage, emptyUsage, estimateTokens, formatReport, metricFromSpawn, totals } from "../lib/metrics.ts";

describe("estimateTokens", () => {
  test("chars/4, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("addUsage", () => {
  test("sums fields and uses totalTokens when present", () => {
    const u = addUsage(emptyUsage(), { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, totalTokens: 18 });
    expect(u).toEqual({ input: 10, output: 5, cacheRead: 2, cacheWrite: 1, total: 18 });
  });

  test("derives total when totalTokens is absent", () => {
    expect(addUsage(emptyUsage(), { input: 10, output: 5 }).total).toBe(15);
  });

  test("ignores non-object input", () => {
    expect(addUsage(emptyUsage(), null)).toEqual(emptyUsage());
    expect(addUsage(emptyUsage(), "nope")).toEqual(emptyUsage());
  });
});

describe("metricFromSpawn", () => {
  test("estimates injected tokens and carries real usage", () => {
    const m = metricFromSpawn("plan", "plan", "p/m", {
      inputChars: 8,
      outputChars: 40,
      usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, total: 120 },
      durationMs: 1234,
    });
    expect(m.estInputTokens).toBe(2); // ceil(8/4)
    expect(m.usage?.total).toBe(120);
    expect(m.phase).toBe("plan");
  });

  test("tolerates a missing real usage (estimate-only path)", () => {
    const m = metricFromSpawn("debug", "debug-x", "p/m", { inputChars: 4, outputChars: 0, usage: null, durationMs: 0 });
    expect(m.usage).toBeNull();
    expect(m.estInputTokens).toBe(1);
  });
});

describe("totals", () => {
  test("aggregates across metrics and flags real usage", () => {
    const real = metricFromSpawn("implement", "impl-a", "p/m", {
      inputChars: 4,
      outputChars: 0,
      usage: { input: 50, output: 10, cacheRead: 0, cacheWrite: 0, total: 60 },
      durationMs: 1000,
    });
    const est = metricFromSpawn("implement", "impl-b", "p/m", { inputChars: 4, outputChars: 0, usage: null, durationMs: 500 });
    const t = totals([real, est]);
    expect(t.calls).toBe(2);
    expect(t.estInputTokens).toBe(2);
    expect(t.usage.total).toBe(60);
    expect(t.durationMs).toBe(1500);
    expect(t.hasRealUsage).toBe(true);
  });
});

describe("formatReport", () => {
  test("notes when there are no metrics", () => {
    expect(formatReport([])).toContain("no token metrics");
  });

  test("includes each phase and a TOTAL line", () => {
    const out = formatReport([
      metricFromSpawn("plan", "plan", "p/m", { inputChars: 8, outputChars: 0, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2 }, durationMs: 0 }),
      metricFromSpawn("review", "review", "p/m", { inputChars: 8, outputChars: 0, usage: null, durationMs: 0 }),
    ]);
    expect(out).toContain("plan:");
    expect(out).toContain("review:");
    expect(out).toContain("TOTAL:");
  });
});
