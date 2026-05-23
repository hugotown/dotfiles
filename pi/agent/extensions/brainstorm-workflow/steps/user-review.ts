// steps/user-review.ts — Step 8 TUI: final confirmation
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";

export type UserReviewAction =
  | { type: "approve" }
  | { type: "request_changes"; feedback: string }
  | { type: "abort" };

export async function showUserReview(
  ctx: ExtensionContext,
  specPath: string,
): Promise<UserReviewAction> {
  const result = await ctx.ui.custom<UserReviewAction>((tui, theme, _kb, done) => {
    const container = new Container();

    container.addChild(
      new Text(theme.fg("success", theme.bold("  ✓ Spec ready")), 0, 0),
    );
    container.addChild(new Text(theme.fg("muted", `  ${specPath}`), 0, 0));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", "  Review the file, then:"), 0, 0));
    container.addChild(
      new Text(
        theme.fg("dim", "  [Enter] ✓ Approve    [R] ✎ Request changes    [Esc] abort"),
        0,
        0,
      ),
    );

    let waitingForInput = false;

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (waitingForInput) return;

        if (matchesKey(data, Key.enter)) {
          done({ type: "approve" });
        } else if (data === "r" || data === "R") {
          waitingForInput = true;
          ctx.ui.input("What changes do you want?", "").then((feedback) => {
            if (feedback) {
              done({ type: "request_changes", feedback });
            } else {
              waitingForInput = false;
              tui.requestRender();
            }
          });
        } else if (matchesKey(data, Key.escape)) {
          done({ type: "abort" });
        }
      },
    };
  });

  return result;
}
