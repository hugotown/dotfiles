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
      const panel = new DaddyPanel({
        store,
        deps,
        done: () => done(),
        requestRender: () => tui.requestRender(),
      });
      return Object.assign(panel, { dispose: () => panel.dispose() });
    },
    {
      overlay: true,
      overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" },
    },
  );
}
