// steps/self-review.ts — Step 7 TUI: issues display
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { ReviewIssue } from "../types.ts";

export type ReviewAction =
  | { type: "auto_fix" }
  | { type: "skip" };

export async function showSelfReview(
  ctx: ExtensionContext,
  issues: ReviewIssue[],
  summary: string,
): Promise<ReviewAction> {
  const highCount = issues.filter((i) => i.severity === "high").length;
  const medCount = issues.filter((i) => i.severity === "medium").length;

  const result = await ctx.ui.custom<ReviewAction>((tui, theme, _kb, done) => {
    const container = new Container();

    // Header
    container.addChild(
      new Text(
        theme.fg("accent", theme.bold(`  Self-review: ${highCount} high, ${medCount} medium issues`)),
        0,
        0,
      ),
    );
    container.addChild(
      new Text(theme.fg("dim", "  [A] Auto-fix all    [Esc] Skip"), 0, 0),
    );
    container.addChild(new Spacer(1));

    // Issues list
    for (const issue of issues) {
      const icon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "⚪";
      container.addChild(
        new Text(
          `  ${icon} ${theme.fg(issue.severity === "high" ? "error" : "warning", `[${issue.severity}]`)} ${theme.fg("muted", issue.section)} — ${issue.type}`,
          0,
          0,
        ),
      );
      container.addChild(
        new Text(theme.fg("dim", `     ${issue.description}`), 0, 0),
      );
      container.addChild(new Spacer(1));
    }

    // Summary
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
    container.addChild(new Text(theme.fg("muted", `  ${summary}`), 0, 0));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (data === "a" || data === "A") {
          done({ type: "auto_fix" });
        } else if (matchesKey(data, Key.escape)) {
          done({ type: "skip" });
        }
      },
    };
  });

  return result;
}
