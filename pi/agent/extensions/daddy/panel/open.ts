// Open a panel as an overlay; resolve on close. Authoring entries (--daddy-list/--daddy-design)
// open the Finder-style WorkflowBrowser (workflows | nodes | fields, all visible); run
// observation opens the live DaddyPanel. Colors, keymap and overlay sizing come from AppConfig.
// Design saves write the workflow YAML to .pi/daddy/workflows/<name>.yaml.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SizeValue } from "@earendil-works/pi-tui";
import type { AppConfig } from "../lib/config.ts";
import { workflowPath } from "../lib/load-workflow.ts";
import { getRun, subscribe } from "../lib/store.ts";
import type { Workflow } from "../types.ts";
import { WorkflowBrowser } from "./browser.ts";
import { toYaml } from "./editor.ts";
import type { WorkflowEntry } from "./list-render.ts";
import { DaddyPanel, type Mode } from "./view.ts";

export interface PanelInitial {
	mode?: Mode;
	workflow?: Workflow;
	workflows?: WorkflowEntry[];
	selectName?: string;
	focus?: 0 | 1 | 2;
}

export function openPanel(ctx: ExtensionContext, config: AppConfig, initial?: PanelInitial): Promise<void> {
	const save = async (wf: Workflow): Promise<void> => {
		const file = workflowPath(ctx.cwd, wf.name);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, toYaml(wf), "utf-8");
		ctx.ui.notify(`daddy: saved ${file}`, "info");
	};

	const m = config.panel.listMargin;
	const isBrowser = initial?.mode === "list" || initial?.mode === "design";
	const span = `${Math.max(10, 100 - 2 * m)}%` as SizeValue;
	const listFrac = Math.max(0.2, (100 - 2 * m) / 100);
	const defaultFrac =
		typeof config.panel.maxHeight === "string" && config.panel.maxHeight.endsWith("%")
			? Math.max(0.2, Number.parseFloat(config.panel.maxHeight) / 100)
			: 0.85;
	const frac = isBrowser ? listFrac : defaultFrac;
	const rows = (tui: { terminal?: { rows: number } }) => () => tui.terminal?.rows || process.stdout.rows || 24;
	const overlayOptions = isBrowser
		? { width: span, maxHeight: span, minWidth: config.panel.minWidth, anchor: "center" as const }
		: {
				width: config.panel.width as SizeValue,
				minWidth: config.panel.minWidth,
				maxHeight: config.panel.maxHeight as SizeValue,
				anchor: "center" as const,
			};

	return ctx.ui.custom<void>(
		(tui, _theme, _keys, done) => {
			const close = () => {
				done();
				tui.requestRender(true);
			};
			if (isBrowser) {
				const browser = new WorkflowBrowser(initial?.workflows ?? [], config.theme, config.keymap, close, () => tui.requestRender(), (wf) => void save(wf));
				browser.setRowsFn(rows(tui));
				browser.setHeightFrac(frac);
				if (initial?.selectName) browser.selectWorkflow(initial.selectName);
				if (initial?.focus !== undefined) browser.setFocus(initial.focus);
				return browser;
			}
			const panel = new DaddyPanel(config.theme, config.keymap, close, () => tui.requestRender(), (wf) => void save(wf));
			panel.setHeightFrac(frac);
			panel.setRowsFn(rows(tui));
			panel.setRun(getRun());
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
