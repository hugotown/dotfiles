// Open the panel as an overlay; re-render on store changes; resolve on close. Colors, keymap
// and overlay sizing come from the loaded AppConfig. The workflows list opens in a centered
// (100 - 2*listMargin)% square (config.panel.listMargin); run/design use config.panel size.
// Design-mode saves write the workflow YAML to .pi/daddy/workflows/<name>.yaml.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SizeValue } from "@earendil-works/pi-tui";
import type { AppConfig } from "../lib/config.ts";
import { workflowPath } from "../lib/load-workflow.ts";
import { getRun, subscribe } from "../lib/store.ts";
import type { Workflow } from "../types.ts";
import { toYaml } from "./editor.ts";
import type { WorkflowEntry } from "./list-render.ts";
import { DaddyPanel, type Mode } from "./view.ts";

export interface PanelInitial {
	mode?: Mode;
	workflow?: Workflow;
	workflows?: WorkflowEntry[];
}

export function openPanel(ctx: ExtensionContext, config: AppConfig, initial?: PanelInitial): Promise<void> {
	const save = async (wf: Workflow): Promise<void> => {
		const file = workflowPath(ctx.cwd, wf.name);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, toYaml(wf), "utf-8");
		ctx.ui.notify(`daddy: saved ${file}`, "info");
	};
	const m = config.panel.listMargin;
	const isList = initial?.mode === "list";
	const span = `${Math.max(10, 100 - 2 * m)}%` as SizeValue;
	const listFrac = Math.max(0.2, (100 - 2 * m) / 100);
	const defaultFrac =
		typeof config.panel.maxHeight === "string" && config.panel.maxHeight.endsWith("%")
			? Math.max(0.2, Number.parseFloat(config.panel.maxHeight) / 100)
			: 0.85;
	// Body-height fraction MUST match the overlay's maxHeight so the content fills it exactly
	// (otherwise margins look bigger than configured). Both derive from the same numbers here.
	const frac = isList ? listFrac : defaultFrac;
	const overlayOptions = isList
		? { width: span, maxHeight: span, minWidth: config.panel.minWidth, anchor: "center" as const }
		: {
				width: config.panel.width as SizeValue,
				minWidth: config.panel.minWidth,
				maxHeight: config.panel.maxHeight as SizeValue,
				anchor: "center" as const,
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
			panel.setHeightFrac(frac);
			panel.setRowsFn(() => tui.terminal?.rows || process.stdout.rows || 24);
			panel.setRun(getRun());
			if (initial?.workflows) panel.setList(initial.workflows);
			if (initial?.workflow) panel.setWorkflow(initial.workflow);
			if (initial?.mode) panel.setMode(initial.mode);
			const unsubscribe = subscribe(() => {
				panel.setRun(getRun());
				tui.requestRender();
			});
			return Object.assign(panel, { dispose: unsubscribe });
		},
		{ overlay: true, overlayOptions },
	);
}
