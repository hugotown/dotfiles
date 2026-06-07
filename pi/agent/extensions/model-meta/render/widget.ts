import { Container, Text, truncateToWidth, visibleWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

// Fixed card width in cells. Wide enough for "knowledge YYYY-MM" + padding,
// narrow enough to leave the right half of the editor free.
const CARD_WIDTH = 44;

// Box-drawing characters
const TL = "┌";
const TR = "┐";
const BL = "└";
const BR = "┘";
const H = "─";
const V = "│";

/** Render the header row: ┌─ <emoji> <name> ──────┐ */
function buildHeader(meta: ModelMeta): string {
  const emoji = providerEmoji(meta.modelsDevProvider ?? meta.piProvider);
  const name = meta.model?.name ?? meta.piId;
  const title = ` ${emoji} ${name} `;
  // Inner width = CARD_WIDTH - 2 (the two corner chars)
  const inner = CARD_WIDTH - 2;
  // Reserve 1 leading H + title + fill the rest with H
  const leading = H;
  const trimmedTitle = truncateToWidth(title, inner - 1, "…", false);
  const remaining = inner - 1 - visibleWidth(trimmedTitle);
  const trailing = H.repeat(Math.max(0, remaining));
  return `${TL}${leading}${trimmedTitle}${trailing}${TR}`;
}

/** Render a content row: │ <text padded to inner width> │ */
function buildRow(text: string): string {
  const inner = CARD_WIDTH - 2; // space between │ and │
  // 1-cell left padding + text + right padding to fill
  const padded = truncateToWidth(` ${text}`, inner, "…", true);
  return `${V}${padded}${V}`;
}

/** Render the bottom border: └──────────────┘ */
function buildFooter(): string {
  return `${BL}${H.repeat(CARD_WIDTH - 2)}${BR}`;
}

/** Compose all content rows for an OK meta. Each return value is one terminal row. */
function buildContentRows(meta: ModelMeta): string[] {
  if (!meta.ok || !meta.model) return [];
  const m = meta.model;
  const rows: string[] = [];

  // Row 1: capability icons (emojis only, compact)
  rows.push(activeIcons(m).join(" "));

  // Row 2: capability labels
  rows.push(activeLabels(m).join(" · "));

  // Row 3: price (per 1M tokens, explicit)
  const priceIn = formatPrice(m.cost?.input);
  const priceOut = formatPrice(m.cost?.output);
  rows.push(`${priceIn} in / ${priceOut} out per 1M`);

  // Row 4: context + output limits + knowledge cutoff
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)}`;
  const out = `out ${formatTokenLimit(m.limit?.output)}`;
  const knowledge = formatKnowledge(m); // "knowledge YYYY-MM" or ""
  const meta4 = knowledge ? `${ctx} · ${out} · ${knowledge}` : `${ctx} · ${out}`;
  rows.push(meta4);

  return rows;
}

// pi-tui's Text component defaults to paddingX=1 + paddingY=1, which would
// shift our manually drawn border and insert blank lines between rows.
// Pass zero padding so each Text renders as exactly one line, no margins.
function rawText(s: string): Text {
  return new Text(s, 0, 0);
}

export function buildWidgetFactory(meta: ModelMeta, _logoPngBase64: string | null): WidgetFactory {
  return (_tui, theme) => {
    const container = new Container();

    if (!meta.ok) {
      // Degraded card: same shape, dim body
      container.addChild(rawText(buildHeader(meta)));
      container.addChild(rawText(theme.fg("dim", buildRow("(not found in models.dev)"))));
      container.addChild(rawText(buildFooter()));
      return container;
    }

    container.addChild(rawText(buildHeader(meta)));
    for (const row of buildContentRows(meta)) {
      container.addChild(rawText(buildRow(row)));
    }
    container.addChild(rawText(buildFooter()));
    return container;
  };
}