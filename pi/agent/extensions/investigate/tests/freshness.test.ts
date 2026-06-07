import { describe, expect, test } from "bun:test";
import { freshnessToDate } from "../lib/freshness.ts";

const NOW = new Date("2025-06-15T12:00:00Z");

describe("freshnessToDate", () => {
  test("any → null (no cutoff)", () => {
    expect(freshnessToDate("any", NOW)).toBeNull();
  });

  test("day → yesterday ISO date", () => {
    expect(freshnessToDate("day", NOW)).toBe("2025-06-14");
  });

  test("week → 7 days ago", () => {
    expect(freshnessToDate("week", NOW)).toBe("2025-06-08");
  });

  test("month → ~30 days ago", () => {
    expect(freshnessToDate("month", NOW)).toBe("2025-05-16");
  });

  test("year → 365 days ago", () => {
    expect(freshnessToDate("year", NOW)).toBe("2024-06-15");
  });
});
