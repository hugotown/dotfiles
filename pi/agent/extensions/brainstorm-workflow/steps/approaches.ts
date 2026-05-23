// steps/approaches.ts — Step 4 TUI: approach selector
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text } from "@earendil-works/pi-tui";
import type { Approach } from "../types.ts";

export interface ApproachSelectionResult {
  selectedId: string | null;
  cancelled: boolean;
}

export async function showApproachSelector(
  ctx: ExtensionContext,
  approaches: Approach[],
  recommendation: string,
  recommendationReasoning: string,
): Promise<ApproachSelectionResult> {
  const items: SelectItem[] = approaches.map((a, i) => {
    const isRecommended = a.id === recommendation;
    const prefix = isRecommended ? "★ " : "  ";
    const letter = String.fromCharCode(65 + i); // A, B, C
    return {
      value: a.id,
      label: `${prefix}${letter}. ${a.title}`,
      description: `effort: ${a.effort} • risk: ${a.risk} — ${a.summary}`,
    };
  });

  const result = await ctx.ui.custom<ApproachSelectionResult>((tui, theme, _kb, done) => {
    const container = new Container();

    // Title
    container.addChild(
      new Text(theme.fg("accent", theme.bold("  Approaches")), 0, 0),
    );
    container.addChild(
      new Text(theme.fg("dim", "  ↑↓ navigate • enter select • esc abort"), 0, 0),
    );
    container.addChild(new Spacer(1));

    // SelectList
    const selectListTheme = getSelectListTheme();
    const selectList = new SelectList(items, Math.min(items.length + 2, 10), selectListTheme);
    selectList.onSelect = (item) => done({ selectedId: item.value, cancelled: false });
    selectList.onCancel = () => done({ selectedId: null, cancelled: true });
    container.addChild(selectList);

    // Recommendation section
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("muted", "  ── Recommendation ──"), 0, 0));
    container.addChild(new Text(theme.fg("dim", `  ${recommendationReasoning}`), 0, 0));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  return result;
}
