import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

// Fixed card width in cells. Matches the previously-approved design.
const CARD_WIDTH = 44;

// Box-drawing characters
const TL = "┌";
const TR = "┐";
const BL = "└";
const BR = "┘";
const ML = "├";
const MR = "┤";
const H = "─";
const V = "│";

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

/** Header row: ┌─ <emoji> <name> ──────┐ */
function buildHeader(meta: ModelMeta): string {
  const emoji = providerEmoji(meta.modelsDevProvider ?? meta.piProvider);
  const name = meta.model?.name ?? meta.piId ?? "no-model";
  const title = ` ${emoji} ${name} `;
  const inner = CARD_WIDTH - 2;
  const trimmedTitle = truncateToWidth(title, inner - 1, "…", false);
  const remaining = inner - 1 - visibleWidth(trimmedTitle);
  const trailing = H.repeat(Math.max(0, remaining));
  return `${TL}${H}${trimmedTitle}${trailing}${TR}`;
}

/** Mid separator: ├──────┤  */
function buildMidSeparator(): string {
  return `${ML}${H.repeat(CARD_WIDTH - 2)}${MR}`;
}

/** Bottom border: └──────┘ */
function buildBottomBorder(): string {
  return `${BL}${H.repeat(CARD_WIDTH - 2)}${BR}`;
}

/** Content row: │ <text padded to inner width> │ */
function buildRow(text: string): string {
  const inner = CARD_WIDTH - 2;
  const padded = truncateToWidth(` ${text}`, inner, "…", true);
  return `${V}${padded}${V}`;
}

/** Four model-info rows (icons, labels, price, limits+knowledge). */
function buildModelRows(meta: ModelMeta): string[] {
  if (!meta.ok || !meta.model) {
    return ["(not found in models.dev)"];
  }
  const m = meta.model;
  return [
    activeIcons(m).join(" "),
    activeLabels(m).join(" · "),
    `${formatPrice(m.cost?.input)} in / ${formatPrice(m.cost?.output)} out per 1M`,
    (() => {
      const ctx = `ctx ${formatTokenLimit(m.limit?.context)}`;
      const out = `out ${formatTokenLimit(m.limit?.output)}`;
      const k = formatKnowledge(m);
      return k ? `${ctx} · ${out} · ${k}` : `${ctx} · ${out}`;
    })(),
  ];
}

/** Two session-info rows: pwd(+branch) and ctx%/cost — live from ctx. */
function buildSessionRows(ctx: ExtensionContext, footerData: ReadonlyFooterDataProvider): string[] {
  // Row A: pwd (+git branch)
  const home = process.env.HOME ?? process.env.USERPROFILE;
  let pwd = formatCwd(ctx.cwd, home);
  const branch = footerData.getGitBranch();
  if (branch) pwd += ` (${branch})`;

  // Row B: ctx% / window  ·  $cost
  const usage = ctx.getContextUsage();
  const pct = usage?.percent != null ? usage.percent.toFixed(1) : "?";
  const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const ctxPart = `ctx ${pct}%/${fmtTokens(window)}`;

  let totalCost = 0;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      totalCost += entry.message.usage.cost.total;
    }
  }
  const costPart = totalCost > 0 ? `$${totalCost.toFixed(3)}` : "$0";

  return [pwd, `${ctxPart} · ${costPart}`];
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
  return (_tui: TUI, _theme: Theme, footerData: ReadonlyFooterDataProvider): Component => {
    return {
      render(_width: number): string[] {
        const ctx = ctxRef.current;
        const meta = metaRef.current;
        if (!ctx || !meta) return [];

        const lines: string[] = [];
        lines.push(buildHeader(meta));
        for (const row of buildModelRows(meta)) lines.push(buildRow(row));
        lines.push(buildMidSeparator());
        for (const row of buildSessionRows(ctx, footerData)) lines.push(buildRow(row));
        lines.push(buildBottomBorder());
        return lines;
      },
      invalidate(): void {
        // No internal cache; render reads ctx/meta refs live each frame.
      },
    };
  };
}