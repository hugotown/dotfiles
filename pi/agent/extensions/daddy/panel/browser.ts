// Miller-columns workflow browser (Finder-style). Three always-visible columns:
//   [0] workflows   [1] nodes of the focused workflow   [2] fields of the focused node
// → / l / enter goes one column deeper (and, in the fields column, edits the field);
// ← / h goes back; ↑/↓ move within the focused column. Editing mutates the in-memory
// workflow; `s` writes its YAML. The list never disappears — it stays in column 0.
import { type Component, Input, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { KeymapConfig } from "../lib/keymap.ts";
import type { ThemeColors } from "../lib/theme.ts";
import type { Workflow, WorkflowNode } from "../types.ts";
import { addNode, removeNode, updateNode } from "./editor.ts";
import type { WorkflowEntry } from "./list-render.ts";
import { type FormField, type FormValues, fieldsFor, nodeToValues, valuesToNode } from "./node-fields.ts";
import { bg, bold, fg, pad } from "./palette.ts";

const LW = 12; // field label width in the edit column
const hit = (d: string, keys: string[]): boolean => keys.some((k) => matchesKey(d, k as KeyId));

export class WorkflowBrowser implements Component {
	private focus: 0 | 1 | 2 = 0;
	private selWf = 0;
	private selNode = 0;
	private selField = 0;
	private values: FormValues = {};
	private editId = "";
	private editing: Input | null = null;
	private rowsFn: () => number = () => process.stdout.rows ?? 24;
	private heightFrac = 0.8;

	constructor(
		private readonly workflows: WorkflowEntry[],
		private readonly theme: ThemeColors,
		private readonly keymap: KeymapConfig,
		private readonly onClose: () => void,
		private readonly onChange: () => void,
		private readonly onSave: (wf: Workflow) => void,
	) {
		this.syncValues();
	}

	setRowsFn(fn: () => number): void {
		this.rowsFn = fn;
	}
	setHeightFrac(f: number): void {
		this.heightFrac = f;
	}
	setFocus(c: 0 | 1 | 2): void {
		this.focus = c;
	}
	selectWorkflow(name: string): void {
		const i = this.workflows.findIndex((w) => w.name === name);
		if (i >= 0) {
			this.selWf = i;
			this.selNode = 0;
			this.syncValues();
		}
	}

	private curWf(): Workflow | null {
		return this.workflows[this.selWf]?.wf ?? null;
	}
	private nodes(): WorkflowNode[] {
		return this.curWf()?.vsm.flatMap((c) => c.nodes) ?? [];
	}
	private curNode(): WorkflowNode | undefined {
		return this.nodes()[this.selNode];
	}
	private fieldList(): FormField[] {
		return this.curNode() ? fieldsFor(this.values) : [];
	}
	private syncValues(): void {
		const n = this.curNode();
		this.values = n ? nodeToValues(n) : {};
		this.editId = n?.id ?? "";
		this.selField = 0;
	}
	private applyValues(): void {
		const wf = this.curWf();
		if (!wf || !this.editId) return;
		const node = valuesToNode(this.values);
		this.workflows[this.selWf].wf = updateNode(wf, this.editId, node);
		this.editId = node.id;
	}

	handleInput(data: string): void {
		if (this.editing) {
			this.editing.handleInput(data);
			return this.onChange();
		}
		const nav = this.keymap.nav;
		if (hit(data, nav.close)) return this.onClose();
		if (hit(data, nav.save)) {
			const wf = this.curWf();
			if (wf) this.onSave(wf);
			return;
		}
		if (hit(data, ["left", "h"])) return this.goLeft();
		if (hit(data, ["right", "l", "enter", "return"])) return this.goRight();
		if (hit(data, nav.up)) return this.move(-1);
		if (hit(data, nav.down)) return this.move(1);
		if (this.focus === 1 && hit(data, nav.add)) return this.addNewNode();
		if (this.focus === 1 && hit(data, nav.delete)) return this.deleteNode();
	}

	private move(dir: number): void {
		if (this.focus === 0) {
			this.selWf = this.clamp(this.selWf + dir, this.workflows.length);
			this.selNode = 0;
			this.syncValues();
		} else if (this.focus === 1) {
			this.selNode = this.clamp(this.selNode + dir, this.nodes().length);
			this.syncValues();
		} else {
			this.selField = this.clamp(this.selField + dir, this.fieldList().length);
		}
		this.onChange();
	}

	private goRight(): void {
		if (this.focus === 0 && this.curWf()) {
			this.focus = 1;
		} else if (this.focus === 1 && this.curNode()) {
			this.focus = 2;
			this.selField = 0;
		} else if (this.focus === 2) {
			this.editField();
		}
		this.onChange();
	}

	private goLeft(): void {
		if (this.focus > 0) this.focus = (this.focus - 1) as 0 | 1 | 2;
		this.onChange();
	}

	/** In the fields column: cycle an enum, or open an inline text editor. */
	private editField(): void {
		const field = this.fieldList()[this.selField];
		if (!field) return;
		if (field.kind === "enum") {
			const opts = field.values ?? [];
			const cur = Math.max(0, opts.indexOf(this.values[field.id] ?? opts[0]));
			this.values[field.id] = opts[(cur + 1) % opts.length];
			this.applyValues();
			return;
		}
		const input = new Input();
		input.setValue(this.values[field.id] ?? "");
		input.focused = true;
		input.onSubmit = (raw: string) => {
			this.values[field.id] = raw;
			this.applyValues();
			this.editing = null;
			this.onChange();
		};
		input.onEscape = () => {
			this.editing = null;
			this.onChange();
		};
		this.editing = input;
	}

	private addNewNode(): void {
		const wf = this.curWf();
		if (!wf) return;
		const count = this.nodes().length;
		this.workflows[this.selWf].wf = addNode(wf, wf.vsm[0]?.sipoc ?? "design", {
			id: `n${count + 1}`,
			action: "bash",
			aiAssisted: false,
			depends_on: [],
			command: "",
		});
		this.selNode = count;
		this.focus = 2;
		this.syncValues();
		this.onChange();
	}

	private deleteNode(): void {
		const wf = this.curWf();
		const node = this.curNode();
		if (wf && node) {
			this.workflows[this.selWf].wf = removeNode(wf, node.id);
			this.selNode = Math.max(0, this.selNode - 1);
			this.syncValues();
		}
		this.onChange();
	}

	private clamp(v: number, len: number): number {
		return Math.max(0, Math.min(v, Math.max(0, len - 1)));
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const height = Math.max(8, Math.floor(this.rowsFn() * this.heightFrac));
		const bodyH = Math.max(1, height - 2);
		const gapW = 3;
		// Narrow workflows + nodes columns; give the rest to editing (where prompts/commands live).
		const c0w = Math.max(12, Math.min(22, Math.floor(width * 0.16)));
		const c1w = Math.max(14, Math.min(28, Math.floor(width * 0.22)));
		const c2w = Math.max(20, width - 2 * gapW - c0w - c1w);
		const gap = bg(t.panelBg, fg(t.dim, " │ "));

		const wfNames = this.workflows.map((w) => w.name + (w.wf ? "" : " ⚠"));
		const nodeLabels = this.nodes().map((n) => `${n.id} [${n.action}${n.aiAssisted ? "·AI" : ""}]`);
		const fieldRows = this.fieldList().map((f, i) => this.fieldRow(f, i, c2w));

		const c0 = this.column("WORKFLOWS", wfNames, this.selWf, this.focus === 0, t, c0w, bodyH);
		const c1 = this.column("NODES", nodeLabels, this.selNode, this.focus === 1, t, c1w, bodyH);
		const c2 = this.column(this.curNode()?.id ?? "NODE", fieldRows, this.selField, this.focus === 2, t, c2w, bodyH);

		const rows: string[] = [];
		for (let i = 0; i < bodyH; i++) rows.push((c0[i] ?? "") + gap + (c1[i] ?? "") + gap + (c2[i] ?? ""));

		const title = bg(t.selectedBg, bold(fg(t.blue, pad(" daddy · workflows", width))));
		const help = bg(t.panelBg, fg(t.dim, pad(this.helpText(), width)));
		return [title, help, ...rows];
	}

	private helpText(): string {
		if (this.focus === 0) return "  ↑/↓ move    →/l/enter nodes    s save    q close";
		if (this.focus === 1) return "  ↑/↓ move    →/l edit    ←/h workflows    a add    d delete    s save    q close";
		return "  ↑/↓ field    enter change/edit    ←/h nodes    s save    q close";
	}

	private fieldRow(f: FormField, i: number, colW: number): string {
		const vw = Math.max(1, colW - LW - 2);
		if (this.editing && this.focus === 2 && i === this.selField) return pad(f.label, LW) + (this.editing.render(vw)[0] ?? "");
		let v = (this.values[f.id] ?? "") || "—";
		if (f.kind === "enum") v = `‹${v}›`;
		return `${pad(f.label, LW)}${pad(v, vw)}`;
	}

	private column(title: string, items: string[], sel: number, focused: boolean, t: ThemeColors, w: number, height: number): string[] {
		const lines = [bg(t.panelBg, bold(fg(focused ? t.blue : t.dim, pad(` ${title}`, w))))];
		for (let i = 0; i < height - 1; i++) {
			const it = items[i];
			const isSel = i === sel && items.length > 0;
			const rowBg = isSel && focused ? t.selectedBg : t.panelBg;
			if (it === undefined) {
				lines.push(bg(rowBg, " ".repeat(w)));
				continue;
			}
			const base = isSel ? (focused ? t.fg : t.muted) : t.muted;
			const cursor = isSel ? (focused ? "›" : " ") : " ";
			lines.push(bg(rowBg, fg(base, pad(`${cursor}${it}`, w))));
		}
		return lines;
	}
}
