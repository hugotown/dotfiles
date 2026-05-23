// steps/design-review.ts — Step 5 TUI: section-by-section review
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, Markdown, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { DesignSection } from "../types.ts";
import { renderWireframe } from "../lib/wireframe.ts";

export type SectionAction =
  | { type: "approve" }
  | { type: "request_changes"; feedback: string }
  | { type: "abort" };

export async function showDesignReview(
  ctx: ExtensionContext,
  title: string,
  sections: DesignSection[],
  sectionIndex: number,
): Promise<SectionAction> {
  const section = sections[sectionIndex];
  const mdTheme = getMarkdownTheme();

  const result = await ctx.ui.custom<SectionAction>((tui, theme, _kb, done) => {
    const container = new Container();

    // Header
    container.addChild(
      new Text(
        theme.fg("accent", theme.bold(`  Design: ${title}`)),
        0,
        0,
      ),
    );
    container.addChild(
      new Text(
        theme.fg("muted", `  Section ${sectionIndex + 1}/${sections.length}: ${section.title}`),
        0,
        0,
      ),
    );
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
    container.addChild(new Spacer(1));

    // Section content as markdown
    container.addChild(new Markdown(section.content, 1, 0, mdTheme));

    // Wireframe if present
    if (section.wireframe) {
      container.addChild(new Spacer(1));
      container.addChild(
        new Text(theme.fg("muted", `  [${section.wireframe.description}]`), 0, 0),
      );
      const renderedLines = renderWireframe(section.wireframe.lines, theme);
      for (const line of renderedLines) {
        container.addChild(new Text(`  ${line}`, 0, 0));
      }
    }

    // Footer
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", "─".repeat(60)), 0, 0));
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
