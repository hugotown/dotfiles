// Parse the --daddy-workflow input, load+validate, resolve the state machine (resume unless
// --daddy-fresh), and guard against a concurrent run on the same file. Returns null when it
// handled the case itself (error notify, no name → picker, --daddy-design → editor).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FLAG_DESIGN, FLAG_FRESH, FLAG_WORKFLOW } from "../constants.ts";
import { loadWorkflow, workflowPath } from "./load-workflow.ts";
import { buildState, loadState, resumeState } from "./state-store.ts";
import { stateFilePath } from "./session-path.ts";
import { validateWorkflow } from "./validate.ts";
import { openPanel } from "../panel/open.ts";
import type { StateMachine, Workflow } from "../types.ts";

/** Split "<flag> <name> <args> [--daddy-fresh|--daddy-design]" into parts (hello pattern). */
export function parseInvocation(text: string): { name: string; args: string; fresh: boolean; design: boolean } {
	const fresh = text.includes(FLAG_FRESH);
	const design = text.includes(FLAG_DESIGN);
	const rest = text.split(FLAG_WORKFLOW).join("").split(FLAG_FRESH).join("").split(FLAG_DESIGN).join("").trim();
	const [name, ...argWords] = rest.split(/\s+/);
	return { name: name ?? "", args: argWords.join(" "), fresh, design };
}

export async function startRun(_pi: ExtensionAPI, ctx: ExtensionContext, text: string): Promise<{ state: StateMachine; file: string } | null> {
	const { name, args, fresh, design } = parseInvocation(text);

	// Design entry (standalone --daddy-design, or as a modifier with a name). Opens the panel
	// in design mode: loads the workflow if it exists, else seeds an empty one with that name.
	// With no name, prompt for one so the saved file gets a real name (not "untitled").
	if (design) {
		if (!ctx.hasUI) {
			ctx.ui.notify("daddy: design mode needs an interactive UI.", "warning");
			return null;
		}
		const wfName = name || ((await ctx.ui.input("daddy: workflow name to design", "untitled"))?.trim() ?? "") || "untitled";
		const existing = await loadWorkflow(ctx.cwd, wfName).catch(() => null);
		const seed: Workflow = existing ?? { name: wfName, vsm: [{ sipoc: "stage", nodes: [] }] };
		ctx.ui.notify(`daddy: opening design panel for '${wfName}'.`, "info");
		void openPanel(ctx, { mode: "design", workflow: seed });
		return null;
	}

	if (!name) {
		ctx.ui.notify("daddy: no workflow name. Use --daddy-design to create one in the panel.", "info");
		return null;
	}
	const wf = await loadWorkflow(ctx.cwd, name).catch(() => null);
	if (!wf) {
		// Missing workflow: open the design panel seeded with this name so saving (s) writes
		// <name>.yaml. Headless has no panel, so there we can only report it.
		if (!ctx.hasUI) {
			ctx.ui.notify(`daddy: ${workflowPath(ctx.cwd, name)} not found.`, "warning");
			return null;
		}
		ctx.ui.notify(`daddy: '${name}' not found — opening the design panel to create it.`, "info");
		const seed: Workflow = { name, vsm: [{ sipoc: "stage", nodes: [] }] };
		void openPanel(ctx, { mode: "design", workflow: seed });
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
