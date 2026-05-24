// Opens the panel as a centered overlay and keeps it streaming by subscribing to the
// store; unsubscribes on dispose. Resolves when the user closes it.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeymapConfig } from "../lib/keymap.ts";
import type { ThemeColors } from "../lib/theme.ts";
import { getRun, subscribe } from "../lib/store.ts";
import { SubagentPanel } from "./view.ts";

export function openPanel(ctx: ExtensionContext, keymap: KeymapConfig, theme: ThemeColors): Promise<void> {
	return ctx.ui.custom<void>(
		(tui, _theme, _keybindings, done) => {
			const panel = new SubagentPanel(keymap, theme, () => done(), () => tui.requestRender());
			panel.setRun(getRun());
			const unsubscribe = subscribe(() => {
				panel.setRun(getRun());
				tui.requestRender();
			});
			return Object.assign(panel, { dispose: unsubscribe });
		},
		{ overlay: true, overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" } },
	);
}
