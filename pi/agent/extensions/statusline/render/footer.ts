import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";

/**
 * Single-line footer: replaces pi's native 2-line footer (pwd + stats) plus
 * the extension-statuses row. All the same data, collapsed into one row.
 *
 * Layout (left-aligned ··· right-aligned):
 *   <pwd> [(<branch>)] [• <session>]  <model-status>  $<cost>  <ctx%>  <model>
 *
 * pwd, branch, session: left side
 * cost + ctx + model: right side
 * model-status (set by model-meta via setStatus): in the middle, dim
 *
 * Always exactly one terminal row.
 */

const MODEL_META_STATUS_KEY = "model-meta";

/** Format a path with ~ for $HOME (mirrors footer.js's formatCwdForFooter). */
function formatCwd(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${cwd.slice(home.length + 1)}`;
  return cwd;
}

/** Compact token formatter (≥1M → "1.2M", ≥1k → "120k"). */
function fmtTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1_000_000)}M`;
}

/**
 * Build the full single-line footer string for a given width.
 * Reads live values from ctx each call so token/context updates re-render.
 */
function buildLine(
  ctx: ExtensionContext,
  footerData: ReadonlyFooterDataProvider,
  theme: Theme,
  width: number,
): string {
  // ── LEFT: pwd (+ branch) (+ session)
  const home = process.env.HOME ?? process.env.USERPROFILE;
  let left = formatCwd(ctx.cwd, home);
  const branch = footerData.getGitBranch();
  if (branch) left += ` (${branch})`;

  // ── MIDDLE: model-meta's status (capabilities + name + price + ctx + knowledge)
  const middle = footerData.getExtensionStatuses().get(MODEL_META_STATUS_KEY) ?? "";

  // ── RIGHT: token stats + context % + model
  const session = ctx.sessionManager;
  let totalCost = 0;
  for (const entry of session.getEntries()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      totalCost += entry.message.usage.cost.total;
    }
  }
  const usage = ctx.getContextUsage();
  const pct = usage?.percent != null ? usage.percent.toFixed(1) : "?";
  const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const ctxStr = `${pct}%/${fmtTokens(window)}`;
  const modelId = ctx.model?.id ?? "no-model";
  const costStr = totalCost > 0 ? `$${totalCost.toFixed(3)} ` : "";
  const right = `${costStr}${ctxStr}  ${modelId}`;

  // ── Compose: left + (gap with middle dim) + right
  // Strategy: left and right are mandatory; middle is best-effort dim filler.
  // Compute padding so right is right-aligned against `width`.
  const dimMiddle = middle ? theme.fg("dim", middle) : "";
  const leftW = visibleWidth(left);
  const middleW = visibleWidth(dimMiddle);
  const rightW = visibleWidth(right);

  // Minimum gap between sections: 2 spaces
  const MIN_GAP = 2;
  const totalNeeded = leftW + (middleW > 0 ? MIN_GAP + middleW : 0) + MIN_GAP + rightW;

  if (totalNeeded <= width) {
    // Everything fits: pad gap before right so it sticks to the edge
    const usedBeforeRight = leftW + (middleW > 0 ? MIN_GAP + middleW : 0);
    const padBeforeRight = width - usedBeforeRight - rightW;
    const middlePart = middleW > 0 ? `  ${dimMiddle}` : "";
    return `${left}${middlePart}${" ".repeat(Math.max(MIN_GAP, padBeforeRight))}${right}`;
  }

  // Doesn't fit: drop middle, try left + right
  if (leftW + MIN_GAP + rightW <= width) {
    const pad = width - leftW - rightW;
    return `${left}${" ".repeat(pad)}${right}`;
  }

  // Still doesn't fit: truncate left to make room for right
  const availForLeft = Math.max(1, width - rightW - MIN_GAP);
  const truncatedLeft = truncateToWidth(left, availForLeft, "…");
  const pad = Math.max(MIN_GAP, width - visibleWidth(truncatedLeft) - rightW);
  return `${truncatedLeft}${" ".repeat(pad)}${right}`;
}

/**
 * Factory for ctx.ui.setFooter(). `ctxRef` is a holder updated by the
 * extension on each lifecycle event so the rendered footer always reflects
 * the current session/model.
 */
export function buildFooterFactory(ctxRef: { current: ExtensionContext | null }) {
  return (_tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider): Component => {
    return {
      render(width: number): string[] {
        const ctx = ctxRef.current;
        if (!ctx) return [""];
        return [buildLine(ctx, footerData, theme, width)];
      },
      invalidate(): void {
        // No cache to invalidate; render reads live values each call.
      },
    };
  };
}