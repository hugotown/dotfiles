// DaddyPanel: opaque master-detail overlay. A title bar + an always-visible help line show
// the current mode and the keys available right now; the body is run-mode (live status tree)
// or design-mode (editable VSM>SIPOC>node tree). Tab toggles modes. Colors come from the
// resolved theme; navigation/editing keys from the keymap (both loaded from config.yml).
// NOTE: design editing is minimal v1 — `a` appends a placeholder bash node you then edit in
// YAML; `d` deletes the selected node; `s` saves. Field-level forms are future work.
import { type Component, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { KeymapConfig } from "../lib/keymap.ts";
import type { ThemeColors } from "../lib/theme.ts";
import type { StateMachine, Workflow } from "../types.ts";
import { addNode, removeNode } from "./editor.ts";
import { nodeIdAtRow, renderDesignBody } from "./design-render.ts";
import { bg, bold, fg, pad } from "./palette.ts";
import { renderRunBody } from "./run-render.ts";

export type Mode = "run" | "design";

const newWorkflow = (): Workflow => ({ name: "untitled", vsm: [{ sipoc: "design", nodes: [] }] });

const HELP: Record<Mode, string> = {
	run: "  ↑/↓ move    Tab → design    q close",
	design: "  ↑/↓ move    a add node    d delete    s save    Tab → run    q close",
};

export class DaddyPanel implements Component {
	private run: StateMachine | null = null;
	private mode: Mode = "run";
	private wf: Workflow = newWorkflow();
	private selected = 0;

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
		const { up, down, close, mode, add, delete: del, save } = this.keymap.nav;
		if (this.hits(data, close)) return this.onClose();
		if (this.hits(data, mode)) {
			this.mode = this.mode === "run" ? "design" : "run";
			this.selected = 0;
			return this.onChange();
		}
		if (this.hits(data, up)) this.selected = Math.max(0, this.selected - 1);
		else if (this.hits(data, down)) this.selected++;
		else if (this.mode === "design" && this.handleDesignEdit(data, add, del, save)) {
			/* edit applied */
		} else return;
		this.onChange();
	}

	/** Design-mode editing keys → pure editor ops. Returns true when an edit was applied. */
	private handleDesignEdit(data: string, add: string[], del: string[], save: string[]): boolean {
		if (this.hits(data, add)) {
			const count = this.wf.vsm.flatMap((c) => c.nodes).length;
			const sipoc = this.wf.vsm[0]?.sipoc ?? "design";
			this.wf = addNode(this.wf, sipoc, { id: `n${count + 1}`, action: "bash", aiAssisted: false, depends_on: [], command: "" });
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

	invalidate(): void {}

	render(width: number): string[] {
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
