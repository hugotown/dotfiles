import type { FreshnessLevel } from "../types.ts";

const DAYS: Record<Exclude<FreshnessLevel, "any">, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export function freshnessToDate(level: FreshnessLevel, now: Date = new Date()): string | null {
  if (level === "any") return null;
  const cutoff = new Date(now.getTime() - DAYS[level] * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}
