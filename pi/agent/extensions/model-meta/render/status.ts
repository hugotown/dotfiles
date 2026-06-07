import type { ModelMeta } from "../types";
import { activeIcons, formatKnowledge, formatPrice, formatTokenLimit } from "./format";

/**
 * Build the compact status-bar string for the active model.
 *
 * `ctx.ui.setStatus` renders this inline in the footer next to other extension
 * statuses (e.g. caffeinate's "☕ awake"), so we get one horizontal line and
 * must keep it short. Capability icons go without labels; everything else is
 * compressed with single-character separators.
 *
 * Example: "📝 🖼️ 🎬 🧠 🔧 Kimi K2.6 · $0.95/$4 · ctx 262k/66k · k. 2024-10"
 */
export function buildStatusText(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) {
    return `[?] ${meta.piId}`;
  }
  const m = meta.model;
  const icons = activeIcons(m).join(" ");
  const price = `${formatPrice(m.cost?.input)}/${formatPrice(m.cost?.output)}`;
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)}/${formatTokenLimit(m.limit?.output)}`;
  const knowledge = formatKnowledge(m).replace("knowledge ", "k. "); // shorter form
  const parts = [icons, m.name, price, ctx];
  if (knowledge) parts.push(knowledge);
  return parts.filter(Boolean).join(" · ");
}