// Open the panel as a centered overlay; re-render on store changes; resolve on close.
// Design-mode saves write the workflow YAML to .pi/daddy/workflows/<name>.yaml.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { workflowPath } from "../lib/load-workflow.ts";
import { getRun, subscribe } from "../lib/store.ts";
import type { Workflow } from "../types.ts";
import { toYaml } from "./editor.ts";
import { DaddyPanel, type Mode } from "./view.ts";

export function openPanel(ctx: ExtensionContext, initial?: { mode?: Mode; workflow?: Workflow }): Promise<void> {
	const save = async (wf: Workflow): Promise<void> => {
		const file = workflowPath(ctx.cwd, wf.name);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, toYaml(wf), "utf-8");
		ctx.ui.notify(`daddy: saved ${file}`, "info");
	};
	return ctx.ui.custom<void>(
		(tui, _theme, _keys, done) => {
			const panel = new DaddyPanel(
				() => done(),
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
