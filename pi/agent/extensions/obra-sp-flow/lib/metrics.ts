// Token telemetry for the LLM phases. Each child-pi run emits a PhaseMetric with
// the REAL billed usage from the child's JSON stream (or null when unavailable)
// plus the size of the prompt WE inject — the lever this pipeline optimizes.
// Metrics are a side-channel: their own session entries (no reducer coupling),
// summarized and written to disk at COMPLETE.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const METRIC_ENTRY = "obra-sp-flow-metric";

/** chars/4 — the same heuristic pi uses in its own estimateTokens(). */
const CHARS_PER_TOKEN = 4;

export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface PhaseMetric {
  /** plan | implement | implement_escalate | review | debug */
  phase: string;
  /** child-pi tag, e.g. "impl-src/foo.ts" */
  tag: string;
  /** provider/model that ran the child */
  model: string;
  /** size of the system+task prompt WE injected (bytes) */
  inputChars: number;
  /** size of the child's final assistant text (bytes) */
  outputChars: number;
  /** chars/4 estimate of the injected prompt — the optimization target */
  estInputTokens: number;
  /** REAL billed usage parsed from the child stream, or null if unavailable */
  usage: UsageTotals | null;
  durationMs: number;
  ts: string;
}

export type RecordMetric = (metric: PhaseMetric) => void;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function emptyUsage(): UsageTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

/** Fold one assistant message's `usage` into the running total (defensive). */
export function addUsage(acc: UsageTotals, u: unknown): UsageTotals {
  if (!u || typeof u !== "object") return acc;
  const r = u as Record<string, number>;
  const input = Number(r.input ?? 0);
  const output = Number(r.output ?? 0);
  const cacheRead = Number(r.cacheRead ?? 0);
  const cacheWrite = Number(r.cacheWrite ?? 0);
  const total = Number(r.totalTokens ?? input + output + cacheRead + cacheWrite);
  return {
    input: acc.input + input,
    output: acc.output + output,
    cacheRead: acc.cacheRead + cacheRead,
    cacheWrite: acc.cacheWrite + cacheWrite,
    total: acc.total + total,
  };
}

/** Build a metric from a child-pi spawn result. */
export function metricFromSpawn(
  phase: string,
  tag: string,
  model: string,
  res: { inputChars: number; outputChars: number; usage: UsageTotals | null; durationMs: number },
): PhaseMetric {
  return {
    phase,
    tag,
    model,
    inputChars: res.inputChars,
    outputChars: res.outputChars,
    estInputTokens: Math.ceil(res.inputChars / CHARS_PER_TOKEN),
    usage: res.usage,
    durationMs: res.durationMs,
    ts: new Date().toISOString(),
  };
}

export function appendMetric(pi: ExtensionAPI, metric: PhaseMetric): void {
  pi.appendEntry(METRIC_ENTRY, metric);
}

export function restoreMetrics(ctx: ExtensionContext): PhaseMetric[] {
  const out: PhaseMetric[] = [];
  const entries = ctx.sessionManager.getBranch() as Array<{ type?: string; customType?: string; data?: PhaseMetric }>;
  for (const e of entries) {
    if (e.type === "custom" && e.customType === METRIC_ENTRY && e.data) out.push(e.data);
  }
  return out;
}

export interface MetricTotals {
  calls: number;
  estInputTokens: number;
  usage: UsageTotals;
  durationMs: number;
  hasRealUsage: boolean;
}

export function totals(metrics: PhaseMetric[]): MetricTotals {
  let usage = emptyUsage();
  let estInputTokens = 0;
  let durationMs = 0;
  let hasRealUsage = false;
  for (const m of metrics) {
    estInputTokens += m.estInputTokens;
    durationMs += m.durationMs;
    if (m.usage) {
      usage = addUsage(usage, { ...m.usage, totalTokens: m.usage.total });
      hasRealUsage = true;
    }
  }
  return { calls: metrics.length, estInputTokens, usage, durationMs, hasRealUsage };
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Compact, terminal-friendly per-phase summary. */
export function formatReport(metrics: PhaseMetric[]): string {
  if (!metrics.length) return "obra-sp-flow: no token metrics recorded.";
  const order: string[] = [];
  const groups = new Map<string, PhaseMetric[]>();
  for (const m of metrics) {
    if (!groups.has(m.phase)) {
      groups.set(m.phase, []);
      order.push(m.phase);
    }
    groups.get(m.phase)!.push(m);
  }
  const lines = ["obra-sp-flow token report (per phase):"];
  for (const phase of order) {
    const ms = groups.get(phase)!;
    const t = totals(ms);
    const real = t.hasRealUsage
      ? `real total ${fmt(t.usage.total)} (in ${fmt(t.usage.input)} out ${fmt(t.usage.output)} cacheR ${fmt(t.usage.cacheRead)})`
      : "real usage n/a";
    lines.push(`  ${phase}: ${ms.length} call(s), inject ~${fmt(t.estInputTokens)} tok, ${real}, ${(t.durationMs / 1000).toFixed(1)}s`);
  }
  const g = totals(metrics);
  const realG = g.hasRealUsage ? ` | real total ${fmt(g.usage.total)}` : "";
  lines.push(`  TOTAL: ${g.calls} call(s), inject ~${fmt(g.estInputTokens)} tok${realG}, ${(g.durationMs / 1000).toFixed(1)}s`);
  return lines.join("\n");
}

export function metricsReportPath(cwd: string, slug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(cwd, "docs", "superpowers", "metrics", `${date}-${slug}.json`);
}

export function writeMetricsReport(cwd: string, slug: string, metrics: PhaseMetric[]): string {
  const p = metricsReportPath(cwd, slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const body = { generatedAt: new Date().toISOString(), totals: totals(metrics), metrics };
  fs.writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, "utf-8");
  return p;
}
