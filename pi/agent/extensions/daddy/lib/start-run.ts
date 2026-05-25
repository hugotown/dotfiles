// Parse the --daddy-workflow input, load+validate, resolve the state machine (resume unless
// --daddy-fresh), and guard against a concurrent run on the same file. Returns null when it
// handled the case itself (error notify, no name → picker, --daddy-design → editor).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FLAG_DESIGN, FLAG_FRESH, FLAG_LIST, FLAG_WORKFLOW } from "../constants.ts";
import { listWorkflows, loadWorkflow, workflowPath } from "./load-workflow.ts";
import { buildState, loadState, resumeState } from "./state-store.ts";
import { stateFilePath } from "./session-path.ts";
import { validateWorkflow } from "./validate.ts";
import { openPanel } from "../panel/open.ts";
import type { WorkflowEntry } from "../panel/list-render.ts";
import type { AppConfig } from "./config.ts";
import type { StateMachine, Workflow } from "../types.ts";

/** Split "<flag> <name> <args> [--daddy-fresh|--daddy-design]" into parts (hello pattern). */
export function parseInvocation(text: string): { name: string; args: string; fresh: boolean; design: boolean } {
	const fresh = text.includes(FLAG_FRESH);
	const design = text.includes(FLAG_DESIGN);
	const rest = text.split(FLAG_WORKFLOW).join("").split(FLAG_FRESH).join("").split(FLAG_DESIGN).join("").trim();
	const [name, ...argWords] = rest.split(/\s+/);
	return { name: name ?? "", args: argWords.join(" "), fresh, design };
}

/** Load every workflow in the project (invalid ones become { wf: null }). */
async function loadAll(cwd: string): Promise<WorkflowEntry[]> {
	const names = await listWorkflows(cwd);
	return Promise.all(names.map(async (n) => ({ name: n, wf: await loadWorkflow(cwd, n).catch(() => null) })));
}

/** Ensure `name` is present in the list (seed an empty workflow if it is new). */
function withSeed(all: WorkflowEntry[], name: string): WorkflowEntry[] {
	if (all.some((w) => w.name === name)) return all;
	return [...all, { name, wf: { name, vsm: [{ sipoc: "stage", nodes: [] }] } }];
}

export async function startRun(_pi: ExtensionAPI, ctx: ExtensionContext, text: string, config: AppConfig): Promise<{ state: StateMachine; file: string } | null> {
	// Standalone --daddy-list: open the panel listing every workflow in this project, each with
	// its node tree preview. Pre-load them all (sync render reads from this) before opening.
	if (text.includes(FLAG_LIST)) {
		if (!ctx.hasUI) {
			ctx.ui.notify("daddy: --daddy-list needs an interactive UI.", "warning");
			return null;
		}
		const workflows = await loadAll(ctx.cwd);
		ctx.ui.notify(`daddy: ${workflows.length} workflow(s) in this project.`, "info");
		void openPanel(ctx, config, { mode: "list", workflows, focus: 0 });
		return null;
	}

	const { name, args, fresh, design } = parseInvocation(text);

	// Design entry (standalone --daddy-design, or a modifier with a name). Opens the Finder-style
	// browser with the FULL workflow list (so it never disappears), focused on the nodes column of
	// the chosen workflow (seeded empty if new). No name → prompt for one.
	if (design) {
		if (!ctx.hasUI) {
			ctx.ui.notify("daddy: design mode needs an interactive UI.", "warning");
			return null;
		}
		const wfName = name || ((await ctx.ui.input("daddy: workflow name to design", "untitled"))?.trim() ?? "") || "untitled";
		const workflows = withSeed(await loadAll(ctx.cwd), wfName);
		void openPanel(ctx, config, { mode: "design", workflows, selectName: wfName, focus: 1 });
		return null;
	}

	if (!name) {
		ctx.ui.notify("daddy: no workflow name. Use --daddy-design to create one in the panel.", "info");
		return null;
	}
	const wf = await loadWorkflow(ctx.cwd, name).catch(() => null);
	if (!wf) {
		// Missing workflow: open the browser with the list + a seeded entry for this name, focused
		// on its (empty) nodes column. Saving with `s` writes <name>.yaml. Headless can't show it.
		if (!ctx.hasUI) {
			ctx.ui.notify(`daddy: ${workflowPath(ctx.cwd, name)} not found.`, "warning");
			return null;
		}
		ctx.ui.notify(`daddy: '${name}' not found — opening the browser to create it.`, "info");
		void openPanel(ctx, config, { mode: "design", workflows: withSeed(await loadAll(ctx.cwd), name), selectName: name, focus: 1 });
		return null;
	}
	const error = validateWorkflow(wf);
	if (error) {
		ctx.ui.notify(`daddy: invalid workflow (${error.kind}).`, "error");
		return null;
	}
	const file = stateFilePath(ctx, name);
	const prior = fresh ? null : await loadState(file);
	if (prior && prior.vsm.some((c) => c.nodes.some((n) => n.status === "running")) && Date.now() - Date.parse(prior.heartbeat) < 60_000) {
		ctx.ui.notify("daddy: a run for this workflow looks active in this cwd. Refusing to start a second.", "error");
		return null;
	}
	const state = prior ? resumeState(prior) : buildState(wf, args, process.pid);
	return { state, file };
}
