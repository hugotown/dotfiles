// DaddyPanel: opaque master-detail overlay. A title bar + an always-visible help line show
// the current mode and the keys available right now. Run mode shows the live status tree;
// design mode shows the editable VSM>SIPOC>node tree. Tab toggles modes. In design mode,
// `a` adds a node and `enter` edits the selected one — both open the NodeForm (choose type
// incl. llm/AI, edit fields), `d` deletes, `s` saves the YAML. Colors/keys come from config.yml.
import { type Component, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { KeymapConfig } from "../lib/keymap.ts";
import type { ThemeColors } from "../lib/theme.ts";
import type { StateMachine, Workflow, WorkflowNode } from "../types.ts";
import { renderDesignBody, nodeIdAtRow } from "./design-render.ts";
import { addNode, removeNode, updateNode } from "./editor.ts";
import { freshValues, nodeToValues } from "./node-fields.ts";
import { NodeForm } from "./node-form.ts";
import { bg, bold, fg, pad } from "./palette.ts";
import { renderRunBody } from "./run-render.ts";

export type Mode = "run" | "design";

const newWorkflow = (): Workflow => ({ name: "untitled", vsm: [{ sipoc: "design", nodes: [] }] });

const HELP: Record<Mode, string> = {
	run: "  ↑/↓ move    Tab → design    q close",
	design: "  ↑/↓ move    a add    enter edit    d delete    s save    Tab → run    q close",
};

export class DaddyPanel implements Component {
	private run: StateMachine | null = null;
	private mode: Mode = "run";
	private wf: Workflow = newWorkflow();
	private selected = 0;
	private form: NodeForm | null = null;
	private editingId: string | null = null;

	constructor(
		private readonly theme: ThemeColors,
		private readonly keymap: KeymapConfig,
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

	private hits(data: string, ids: string[]): boolean {
		return ids.some((id) => matchesKey(data, id as KeyId));
	}

	handleInput(data: string): void {
		if (this.form) return this.form.handleInput(data); // the form drives itself (own onChange/onDone)
		const { up, down, close, mode, add, delete: del, save } = this.keymap.nav;
		if (this.hits(data, close)) return this.onClose();
		if (this.hits(data, mode)) {
			this.mode = this.mode === "run" ? "design" : "run";
			this.selected = 0;
			return this.onChange();
		}
		if (this.hits(data, up)) this.selected = Math.max(0, this.selected - 1);
		else if (this.hits(data, down)) this.selected++;
		else if (this.mode === "design" && this.handleDesignKey(data, add, del, save)) {
			/* edit applied / form opened */
		} else return;
		this.onChange();
	}

	/** Design-mode keys. Returns true when something was handled. */
	private handleDesignKey(data: string, add: string[], del: string[], save: string[]): boolean {
		if (this.hits(data, add)) {
			this.openForm(freshValues(), null);
			return true;
		}
		if (this.hits(data, ["enter", "return"])) {
			const id = nodeIdAtRow(this.wf, this.selected);
			const node = this.wf.vsm.flatMap((c) => c.nodes).find((n) => n.id === id);
			if (node) this.openForm(nodeToValues(node), node.id);
			return true;
		}
		if (this.hits(data, del)) {
			const id = nodeIdAtRow(this.wf, this.selected);
			if (id) this.wf = removeNode(this.wf, id);
			return true;
		}
		if (this.hits(data, save)) {
			this.onSave?.(this.wf);
			return true;
		}
		return false;
	}

	private openForm(values: Record<string, string>, editingId: string | null): void {
		this.editingId = editingId;
		this.form = new NodeForm(editingId ? `edit node · ${editingId}` : "add node", values, this.theme, (node) => this.onFormDone(node), this.onChange);
		this.onChange();
	}

	private onFormDone(node: WorkflowNode | null): void {
		if (node) {
			if (this.editingId) this.wf = updateNode(this.wf, this.editingId, node);
			else this.wf = addNode(this.wf, this.wf.vsm[0]?.sipoc ?? "design", node);
		}
		this.form = null;
		this.editingId = null;
		this.onChange();
	}

	invalidate(): void {}

	render(width: number): string[] {
		if (this.form) return this.form.render(width);
		const t = this.theme;
		const height = Math.max(8, Math.floor((process.stdout.rows ?? 24) * 0.7));
		const bodyHeight = Math.max(1, height - 2);
		const title =
			this.mode === "run"
				? ` daddy · run · ${this.run?.workflow ?? "—"} (${this.okCount()}/${this.total()})`
				: ` daddy · design · ${this.wf.name}`;
		const titleBar = bg(t.selectedBg, bold(fg(t.blue, pad(title, width))));
		const helpBar = bg(t.panelBg, fg(t.dim, pad(HELP[this.mode], width)));
		const body =
			this.mode === "run"
				? renderRunBody(this.run, this.selected, t, width, bodyHeight)
				: renderDesignBody(this.wf, this.selected, t, width, bodyHeight);
		return [titleBar, helpBar, ...body];
	}

	private total(): number {
		return this.run ? this.run.vsm.reduce((n, c) => n + c.nodes.length, 0) : 0;
	}

	private okCount(): number {
		return this.run ? this.run.vsm.reduce((n, c) => n + c.nodes.filter((x) => x.status === "ok").length, 0) : 0;
	}
}
