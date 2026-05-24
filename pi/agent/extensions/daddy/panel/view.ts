// DaddyPanel: master-detail overlay. Run mode shows the live status tree; design mode
// shows the editable VSM>SIPOC>node tree. Tab toggles modes. Design editing uses the pure,
// tested editor ops (add/delete) and saves via the onSave callback (open.ts writes the YAML).
// NOTE: inline multi-field node editing is intentionally minimal for v1 — `a` appends a
// placeholder bash node you then edit in YAML; richer in-panel forms are future work.
import { type Component, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { StateMachine, Workflow } from "../types.ts";
import { addNode, removeNode } from "./editor.ts";
import { renderDesign } from "./design-render.ts";
import { renderRun } from "./run-render.ts";

export type Mode = "run" | "design";

const newWorkflow = (): Workflow => ({ name: "untitled", vsm: [{ sipoc: "design", nodes: [] }] });

export class DaddyPanel implements Component {
	private run: StateMachine | null = null;
	private mode: Mode = "run";
	private wf: Workflow = newWorkflow();
	private selected = 0;

	constructor(
		private readonly onClose: () => void,
		private readonly onChange: () => void,
		private readonly onSave?: (wf: Workflow) => void,
	) {}

	setRun(run: StateMachine | null): void {
		this.run = run;
	}

	setWorkflow(wf: Workflow): void {
		this.wf = wf;
	}

	setMode(mode: Mode): void {
		this.mode = mode;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape" as KeyId) || matchesKey(data, "q" as KeyId)) return this.onClose();
		if (matchesKey(data, "tab" as KeyId)) {
			this.mode = this.mode === "run" ? "design" : "run";
			this.selected = 0;
			return this.onChange();
		}
		if (matchesKey(data, "down" as KeyId) || matchesKey(data, "j" as KeyId)) this.selected++;
		else if (matchesKey(data, "up" as KeyId) || matchesKey(data, "k" as KeyId)) this.selected = Math.max(0, this.selected - 1);
		else if (this.mode === "design" && this.handleDesignEdit(data)) {
			/* edit applied */
		} else return;
		this.onChange();
	}

	/** Design-mode editing keys → pure editor ops. Returns true when an edit was applied. */
	private handleDesignEdit(data: string): boolean {
		if (matchesKey(data, "a" as KeyId)) {
			const count = this.wf.vsm.flatMap((c) => c.nodes).length;
			const sipoc = this.wf.vsm[0]?.sipoc ?? "design";
			this.wf = addNode(this.wf, sipoc, { id: `n${count + 1}`, action: "bash", aiAssisted: false, depends_on: [], command: "" });
			return true;
		}
		if (matchesKey(data, "d" as KeyId) || matchesKey(data, "x" as KeyId)) {
			const node = this.wf.vsm.flatMap((c) => c.nodes)[Math.max(0, this.selected - 1)];
			if (node) this.wf = removeNode(this.wf, node.id);
			return true;
		}
		if (matchesKey(data, "s" as KeyId)) {
			this.onSave?.(this.wf);
			return true;
		}
		return false;
	}

	invalidate(): void {}

	render(width: number): string[] {
		return this.mode === "run" ? renderRun(this.run, this.selected, width) : renderDesign(this.wf, this.selected, width);
	}
}
