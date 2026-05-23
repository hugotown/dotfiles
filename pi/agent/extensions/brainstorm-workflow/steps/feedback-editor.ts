// steps/feedback-editor.ts — Multi-line editor for free-form feedback
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import { Container, Editor, type EditorTheme, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { Assumption, Question } from "../types.ts";

/**
 * Show a multi-line editor for free-form feedback.
 * Returns the text, or null if cancelled.
 */
export async function showFeedbackEditor(
  ctx: ExtensionContext,
  assumptions: Assumption[],
  questions: Question[],
  requestTitle: string,
): Promise<string | null> {
  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();

    // Header
    container.addChild(
      new Text(theme.fg("accent", theme.bold(`  Feedback: ${requestTitle}`)), 0, 0),
    );
    container.addChild(new Spacer(1));
    container.addChild(
      new Text(theme.fg("dim", "  Explain what's wrong with the assumptions/questions, or answer them directly."), 0, 0),
    );
    container.addChild(
      new Text(theme.fg("dim", "  The agent will reformulate or proceed based on your feedback."), 0, 0),
    );
    container.addChild(new Spacer(1));

    // Context reminder
    if (assumptions.length > 0 || questions.length > 0) {
      const contextParts: string[] = [];
      if (assumptions.length > 0) contextParts.push(`${assumptions.length} assumptions`);
      if (questions.length > 0) contextParts.push(`${questions.length} questions`);
      container.addChild(
        new Text(theme.fg("muted", `  Context: ${contextParts.join(", ")} were presented`), 0, 0),
      );
      container.addChild(new Spacer(1));
    }

    // Editor
    const editorTheme: EditorTheme = {
      borderColor: (s: string) => theme.fg("border", s),
      selectList: getSelectListTheme(),
    };
    const editor = new Editor(tui, editorTheme, { paddingX: 2 });

    editor.onSubmit = (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length > 0) done(trimmed);
    };

    container.addChild(editor);
    container.addChild(new Spacer(1));
    container.addChild(
      new Text(theme.fg("dim", "  Enter to submit • Shift+Enter for new line • Esc to cancel"), 0, 0),
    );

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "escape")) {
          done(null);
          return;
        }
        editor.handleInput(data);
        tui.requestRender();
      },
    };
  });
}
