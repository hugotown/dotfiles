// steps/questions.ts — TUI: questions form with submenu-based option selection
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Spacer, Text } from "@earendil-works/pi-tui";
import type { Assumption, Question } from "../types.ts";
import { showFeedbackEditor } from "./feedback-editor.ts";
import { createQuestionSubmenu } from "./question-submenu.ts";

export interface QuestionsFormResult {
  answers: Record<string, string>;
  feedback?: string;
  cancelled: boolean;
  skipped: boolean;
}

export async function showQuestionsForm(
  ctx: ExtensionContext,
  assumptions: Assumption[],
  questions: Question[],
  requestTitle: string,
): Promise<QuestionsFormResult> {
  const answers: Record<string, string> = {};
  for (const q of questions) answers[q.id] = q.default;

  const formResult = await ctx.ui.custom<QuestionsFormResult & { _feedbackRequested?: boolean }>(
    (tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new Text(theme.fg("accent", theme.bold(`  Brainstorming: ${requestTitle}`)), 0, 0));
      container.addChild(new Text(theme.fg("dim", "  ↑↓ navigate • enter to select option • esc cancel"), 0, 0));
      container.addChild(new Spacer(1));

      // Assumptions (read-only)
      if (assumptions.length > 0) {
        container.addChild(new Text(theme.fg("muted", "  Assumptions:"), 0, 0));
        for (const a of assumptions) {
          const icon = a.confidence === "high"
            ? theme.fg("success", "✓") : a.confidence === "medium"
              ? theme.fg("warning", "~") : theme.fg("error", "?");
          container.addChild(new Text(`  ${icon} ${a.text}${theme.fg("dim", ` (${a.confidence})`)}`, 0, 0));
        }
        container.addChild(new Spacer(1));
      }

      // Questions
      if (questions.length > 0) container.addChild(new Text(theme.fg("muted", "  Questions:"), 0, 0));

      const items: SettingItem[] = questions.map((q) => {
        const values = q.type === "select" && q.options ? q.options : [q.default];
        return {
          id: q.id,
          label: q.label,
          currentValue: answers[q.id] ?? q.default,
          values,
          description: q.reasoning,
          submenu: values.length > 1 ? createQuestionSubmenu(q, values, theme, tui) : undefined,
        };
      });

      const settingsList = new SettingsList(
        items, Math.min(items.length + 2, 15), getSettingsListTheme(),
        (id, val) => { answers[id] = val; },
        () => done({ answers, cancelled: true, skipped: false }),
      );
      container.addChild(settingsList);
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("dim", "  [C] Confirm  [S] Skip  [F] Feedback  [Esc] Cancel"), 0, 0));

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (data === "c" || data === "C") { done({ answers, cancelled: false, skipped: false }); return; }
          if (data === "s" || data === "S") { done({ answers, cancelled: false, skipped: true }); return; }
          if (data === "f" || data === "F") { done({ answers, cancelled: false, skipped: false, _feedbackRequested: true }); return; }
          settingsList.handleInput(data);
          tui.requestRender();
        },
      };
    },
  );

  if (formResult._feedbackRequested) {
    const feedback = await showFeedbackEditor(ctx, assumptions, questions, requestTitle);
    if (feedback === null) return { answers, cancelled: true, skipped: false };
    return { answers, feedback, cancelled: false, skipped: false };
  }
  return formResult;
}
