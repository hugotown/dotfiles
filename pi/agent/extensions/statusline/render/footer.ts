import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

const PANEL_MAX_WIDTH = 56;
const PANEL_MIN_WIDTH = 24;
const INDENT = "  ";
const BAR_WIDTH = 8;

type UsageTone = "success" | "warning" | "error";

/** Compact token formatter mirroring pi's native footer (formatTokens in footer.js). */
function fmtTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1_000_000)}M`;
}

/** Format absolute path with ~ for $HOME. */
function formatCwd(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${cwd.slice(home.length + 1)}`;
  return cwd;
}

function panelWidth(width: number): number {
  if (width <= 0) return PANEL_MIN_WIDTH;
  if (width < PANEL_MIN_WIDTH) return width;
  return Math.min(width, PANEL_MAX_WIDTH);
}

function padLine(text: string, width: number): string {
  const truncated = truncateToWidth(text, width, "…", false);
  const pad = Math.max(0, width - visibleWidth(truncated));
  return truncated + " ".repeat(pad);
}

function border(theme: Theme, width: number): string {
  return theme.fg("accent", "─".repeat(width));
}

function row(text: string, width: number): string {
  return padLine(`${INDENT}${text}`, width);
}

function label(theme: Theme, text: string): string {
  return theme.fg("muted", text);
}

function usageTone(percent: number): UsageTone {
  if (percent >= 85) return "error";
  if (percent >= 60) return "warning";
  return "success";
}

function buildUsageBar(theme: Theme, percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const tone = usageTone(clamped);
  return theme.fg(tone, "█".repeat(filled)) + theme.fg("dim", "░".repeat(BAR_WIDTH - filled));
}

function buildTitleRow(meta: ModelMeta, theme: Theme): string {
  const emoji = providerEmoji(meta.modelsDevProvider ?? meta.piProvider);
  const name = meta.model?.name ?? meta.piId ?? "no-model";
  return theme.fg("accent", theme.bold(`${emoji} ${name}`));
}

function buildCapabilitiesRow(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "(capabilities unavailable)";
  return activeIcons(meta.model).join(" ");
}

function buildSpecRow(meta: ModelMeta, theme: Theme): string {
  if (!meta.ok || !meta.model) {
    return `${label(theme, "spec")}  ${theme.fg("dim", "unresolved in models.dev")}`;
  }

  const m = meta.model;
  const parts = [
    `${formatPrice(m.cost?.input)} in`,
    `${formatPrice(m.cost?.output)} out`,
    `ctx ${formatTokenLimit(m.limit?.context)}`,
    `out ${formatTokenLimit(m.limit?.output)}`,
  ];
  const knowledge = formatKnowledge(m);
  if (knowledge) parts.push(knowledge.replace(/^knowledge\s+/, "k "));

  return `${label(theme, "spec")}  ${theme.fg("dim", parts.join(" · "))}`;
}

function buildRepoRow(ctx: ExtensionContext, footerData: ReadonlyFooterDataProvider, theme: Theme): string {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  let pwd = formatCwd(ctx.cwd, home);
  const branch = footerData.getGitBranch();
  if (branch) pwd += ` (${branch})`;
  return `${label(theme, "repo")}  ${theme.fg("dim", pwd)}`;
}

function buildLiveRow(ctx: ExtensionContext, theme: Theme): string {
  const usage = ctx.getContextUsage();
  const pct = usage?.percent ?? 0;
  const pctText = `${pct.toFixed(1)}%`;
  const tone = usageTone(pct);
  const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;

  let totalCost = 0;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      totalCost += entry.message.usage.cost.total;
    }
  }
  const costPart = totalCost > 0 ? `$${totalCost.toFixed(3)}` : "$0";

  const bar = buildUsageBar(theme, pct);
  const coloredPct = theme.fg(tone, pctText);
  return `${label(theme, "live")}  ${bar} ${coloredPct}${theme.fg("dim", ` / ${fmtTokens(window)} · ${costPart}`)}`;
}

/**
 * Footer Component factory. Called once by setFooter; the returned Component's
 * render() runs every frame. We close over a metaRef holder (updated by the
 * extension on model_select) and a live ExtensionContext for session stats.
 */
export function buildFooterFactory(
  ctxRef: { current: ExtensionContext | null },
  metaRef: { current: ModelMeta | null },
) {
  return (_tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider): Component => {
    return {
      render(width: number): string[] {
        const ctx = ctxRef.current;
        const meta = metaRef.current;
        if (!ctx || !meta) return [];

        const w = panelWidth(width);
        return [
          border(theme, w),
          row(buildTitleRow(meta, theme), w),
          row(buildCapabilitiesRow(meta), w),
          row(buildSpecRow(meta, theme), w),
          row(buildRepoRow(ctx, footerData, theme), w),
          row(buildLiveRow(ctx, theme), w),
          border(theme, w),
        ];
      },
      invalidate(): void {
        // No internal cache; render reads ctx/meta refs live each frame.
      },
    };
  };
}
