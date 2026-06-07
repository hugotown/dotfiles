import { Container, Image, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

// Wider separator between semantic groups (capabilities | identity | cost/limits).
// Single "·" keeps items within a group; "  ·  " visually breaks groups apart.
const GROUP_SEP = "  ·  ";
const ITEM_SEP = " · ";

function buildInfoLine(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  // Group 1: capabilities — pair each icon with its label (icon label · icon label · …)
  const icons = activeIcons(m);
  const labels = activeLabels(m);
  const capabilities = icons.map((ic, i) => `${ic} ${labels[i] ?? ""}`.trim()).join(ITEM_SEP);
  // Group 2: identity (just the model name)
  const identity = m.name;
  // Group 3: cost + limits + knowledge — "ctx X · out Y" is explicit; "in/out" prices are paired
  const price = `${formatPrice(m.cost?.input)}/${formatPrice(m.cost?.output)}`;
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)} · out ${formatTokenLimit(m.limit?.output)}`;
  const knowledge = formatKnowledge(m);
  const costGroup = [price, ctx, knowledge].filter(Boolean).join(ITEM_SEP);

  return [capabilities, identity, costGroup].filter(Boolean).join(GROUP_SEP);
}

export function buildWidgetFactory(meta: ModelMeta, logoPngBase64: string | null): WidgetFactory {
  return (_tui, theme) => {
    const container = new Container();

    if (!meta.ok) {
      const line1 = `[?] ${meta.piId} · ${meta.piProvider}`;
      const line2 = "(model not found in models.dev catalog)";
      container.addChild(new Text(line1));
      container.addChild(new Text(theme.fg("dim", line2)));
      return container;
    }

    // Line 0: logo
    if (logoPngBase64) {
      const img = new Image(
        logoPngBase64,
        "image/png",
        { fallbackColor: (s: string) => theme.fg("dim", s) },
        { maxHeightCells: 1, maxWidthCells: 2 },
      );
      container.addChild(img);
    } else {
      container.addChild(new Text(providerEmoji(meta.piProvider)));
    }

    // Line 1: capabilities + name + price + ctx + knowledge
    container.addChild(new Text(buildInfoLine(meta)));
    return container;
  };
}
