// steps/question-submenu.ts — SelectList submenu factory for a single question
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import type { Question } from "../types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";

/**
 * Create a submenu component that shows all options for a question in a SelectList.
 * Used by SettingsList's submenu property.
 */
export function createQuestionSubmenu(
  q: Question,
  values: string[],
  theme: Theme,
  tui: TUI,
) {
  return (currentValue: string, submenuDone: (selectedValue?: string) => void) => {
    const selectItems: SelectItem[] = values.map((v) => ({
      value: v,
      label: v === currentValue ? `● ${v}` : `  ${v}`,
      description: v === q.default ? "(default)" : undefined,
    }));

    const sub = new Container();
    sub.addChild(new Text(theme.fg("accent", theme.bold(`  ${q.label}`)), 0, 0));
    sub.addChild(new Spacer(1));
    if (q.reasoning) {
      sub.addChild(new Text(theme.fg("dim", `  ${q.reasoning}`), 0, 0));
      sub.addChild(new Spacer(1));
    }

    const selectList = new SelectList(selectItems, Math.min(selectItems.length, 12), getSelectListTheme());
    const idx = values.indexOf(currentValue);
    if (idx >= 0) selectList.setSelectedIndex(idx);
    selectList.onSelect = (item) => submenuDone(item.value);
    selectList.onCancel = () => submenuDone(undefined);
    sub.addChild(selectList);
    sub.addChild(new Spacer(1));
    sub.addChild(new Text(theme.fg("dim", "  ↑↓ navigate • enter confirm • esc back"), 0, 0));

    return {
      render: (w: number) => sub.render(w),
      invalidate: () => sub.invalidate(),
      handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender(); },
    };
  };
}
