// Open the panel as a centered overlay; re-render on store changes; resolve on close.
// Colors + keymap come from the loaded AppConfig. Design-mode saves write the workflow YAML
// to .pi/daddy/workflows/<name>.yaml.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AppConfig } from "../lib/config.ts";
import { workflowPath } from "../lib/load-workflow.ts";
import { getRun, subscribe } from "../lib/store.ts";
import type { Workflow } from "../types.ts";
import { toYaml } from "./editor.ts";
import { DaddyPanel, type Mode } from "./view.ts";

export function openPanel(ctx: ExtensionContext, config: AppConfig, initial?: { mode?: Mode; workflow?: Workflow }): Promise<void> {
	const save = async (wf: Workflow): Promise<void> => {
		const file = workflowPath(ctx.cwd, wf.name);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, toYaml(wf), "utf-8");
		ctx.ui.notify(`daddy: saved ${file}`, "info");
	};
	return ctx.ui.custom<void>(
		(tui, _theme, _keys, done) => {
			// Force a full-clear redraw on close: ctx.ui hides the overlay with a THROTTLED
			// render, so without this the closed panel can linger on screen (looks like it
			// didn't exit). Same workaround gemini's form uses.
			const panel = new DaddyPanel(
				config.theme,
				config.keymap,
				() => {
					done();
					tui.requestRender(true);
				},
				() => tui.requestRender(),
				(wf) => void save(wf),
			);
			panel.setRun(getRun());
			if (initial?.workflow) panel.setWorkflow(initial.workflow);
			if (initial?.mode) panel.setMode(initial.mode);
			const unsubscribe = subscribe(() => {
				panel.setRun(getRun());
				tui.requestRender();
			});
			return Object.assign(panel, { dispose: unsubscribe });
		},
		{ overlay: true, overlayOptions: { width: "85%", maxHeight: "85%", anchor: "center" } },
	);
}
