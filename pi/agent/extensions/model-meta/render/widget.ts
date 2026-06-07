import { Container, Image, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

function buildInfoLine(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  // Capabilities first: pair each icon with its label (icon label · icon label · …)
  const icons = activeIcons(m);
  const labels = activeLabels(m);
  const capabilities = icons.map((ic, i) => `${ic} ${labels[i] ?? ""}`.trim()).join(" · ");
  const price = `${formatPrice(m.cost?.input)}/${formatPrice(m.cost?.output)}`;
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)}/${formatTokenLimit(m.limit?.output)}`;
  const knowledge = formatKnowledge(m);
  const parts = [capabilities, m.name, price, ctx];
  if (knowledge) parts.push(knowledge);
  return parts.filter(Boolean).join(" · ");
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
