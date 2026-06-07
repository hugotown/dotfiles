import { Container, Image, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

function buildLine1(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  const price = `${formatPrice(m.cost?.input)}/${formatPrice(m.cost?.output)}`;
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)} / out ${formatTokenLimit(m.limit?.output)}`;
  return `${m.name} · ${meta.piProvider} · ${price} · ${ctx}`;
}

function buildLine2(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  const icons = activeIcons(m).join(" ");
  const labels = activeLabels(m).join(" · ");
  const knowledge = formatKnowledge(m);
  const parts = [icons, labels].filter(Boolean);
  if (knowledge) parts.push(knowledge);
  return parts.join(" · ");
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

    // Line 1, Line 2
    container.addChild(new Text(buildLine1(meta)));
    container.addChild(new Text(buildLine2(meta)));
    return container;
  };
}
