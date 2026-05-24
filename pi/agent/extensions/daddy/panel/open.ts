// Open the panel as a centered overlay; re-render on store changes; resolve on close.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getRun, subscribe } from "../lib/store.ts";
import { DaddyPanel } from "./view.ts";

export function openPanel(ctx: ExtensionContext): Promise<void> {
	return ctx.ui.custom<void>(
		(tui, _theme, _keys, done) => {
			const panel = new DaddyPanel(() => done(), () => tui.requestRender());
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
