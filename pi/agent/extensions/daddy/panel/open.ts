// panel/open.ts — Opens the daddy panel as a centered overlay.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RunDeps } from "../runtime-types.ts";
import type { Store } from "./store.ts";
import { DaddyPanel } from "./component.ts";

export function openDaddyPanel(
  ctx: ExtensionContext,
  store: Store,
  deps: RunDeps,
): Promise<void> {
  return ctx.ui.custom<void>(
    (tui, _theme, _kb, done) => {
      const terminalRows = tui.terminal.rows ?? process.stdout.rows ?? 24;
      const panel = new DaddyPanel({
        store,
        deps,
        done: () => done(),
        requestRender: () => tui.requestRender(),
        height: terminalRows,
      });
      return Object.assign(panel, { dispose: () => panel.dispose() });
    },
    {
      overlay: true,
      overlayOptions: { width: "100%", maxHeight: "100%", anchor: "center" },
    },
  );
}
