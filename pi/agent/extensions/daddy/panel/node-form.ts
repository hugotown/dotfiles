// Interactive node editor: a bordered, opaque form for one node. Action is an enum field, so
// you choose bash/flag/llm/ask here (llm = an AI node); the visible fields adapt to it. Text
// fields edit with the pi-tui Input widget; enum fields cycle in place. onDone returns the
// built WorkflowNode on Save, or null on Cancel. Modeled on gemini's FormPanel + render.
import { Input, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { ThemeColors } from "../lib/theme.ts";
import type { WorkflowNode } from "../types.ts";
import { type FormField, type FormValues, fieldsFor, valuesToNode } from "./node-fields.ts";
import { bg, bold, fg, pad } from "./palette.ts";

const LABEL_W = 14;
const hit = (d: string, keys: string[]): boolean => keys.some((k) => matchesKey(d, k as KeyId));

export class NodeForm {
	private values: FormValues;
	private sel = 0;
	private editing: Input | null = null;

	constructor(
		private readonly title: string,
		initial: FormValues,
		private readonly theme: ThemeColors,
		private readonly onDone: (node: WorkflowNode | null) => void,
		private readonly onChange: () => void,
	) {
		this.values = { ...initial };
	}

	private fields(): FormField[] {
		return fieldsFor(this.values);
	}

	handleInput(data: string): void {
		if (this.editing) {
			this.editing.handleInput(data);
			return this.onChange();
		}
		const fields = this.fields();
		const rows = fields.length + 2; // + Save + Cancel
		this.sel = Math.min(this.sel, rows - 1);
		if (hit(data, ["escape"])) return this.onDone(null);
		if (hit(data, ["up", "k"])) {
			this.sel = (this.sel - 1 + rows) % rows;
			return this.onChange();
		}
		if (hit(data, ["down", "j", "tab"])) {
			this.sel = (this.sel + 1) % rows;
			return this.onChange();
		}
		if (this.sel === fields.length) {
			if (hit(data, ["enter", "return"])) this.onDone(valuesToNode(this.values));
			return;
		}
		if (this.sel === fields.length + 1) {
			if (hit(data, ["enter", "return"])) this.onDone(null);
			return;
		}
		const field = fields[this.sel];
		if (field.kind === "enum") {
			const opts = field.values ?? [];
			const cur = Math.max(0, opts.indexOf(this.values[field.id] ?? opts[0]));
			if (hit(data, ["left", "h"])) this.values[field.id] = opts[(cur - 1 + opts.length) % opts.length];
			else if (hit(data, ["right", "l", "enter", "return"])) this.values[field.id] = opts[(cur + 1) % opts.length];
			else return;
			return this.onChange();
		}
		if (hit(data, ["enter", "return"])) this.startEdit(field);
	}

	private startEdit(field: FormField): void {
		const input = new Input();
		input.setValue(this.values[field.id] ?? "");
		input.focused = true;
		input.onSubmit = (raw: string) => {
			this.values[field.id] = raw;
			this.editing = null;
			this.onChange();
		};
		input.onEscape = () => {
			this.editing = null;
			this.onChange();
		};
		this.editing = input;
		this.onChange();
	}

	render(width: number): string[] {
		const t = this.theme;
		const W = Math.max(36, Math.min(width, 80));
		const CW = W - 4;
		const frame = (ch: string) => bg(t.panelBg, fg(t.dim, ch));
		const row = (content: string, rowBg: string) => frame("│") + bg(rowBg, ` ${pad(content, CW)} `) + frame("│");
		const fields = this.fields();
		const out = [this.topBorder(W)];
		out.push(row(fg(t.dim, "  ↑/↓ move · ←/→ change · enter edit · esc cancel"), t.panelBg));
		fields.forEach((f, i) => out.push(row(this.fieldContent(f, i === this.sel, CW), i === this.sel ? t.selectedBg : t.panelBg)));
		out.push(frame("├") + frame("─".repeat(W - 2)) + frame("┤"));
		out.push(row(this.buttons(), t.panelBg));
		out.push(frame("╰") + frame("─".repeat(W - 2)) + frame("╯"));
		return out;
	}

	private topBorder(W: number): string {
		const t = this.theme;
		const tt = ` ${this.title} `;
		const dashes = Math.max(0, W - 3 - tt.length);
		return bg(t.panelBg, fg(t.dim, "╭─") + bold(fg(t.blue, tt)) + fg(t.dim, `${"─".repeat(dashes)}╮`));
	}

	private fieldContent(f: FormField, selected: boolean, CW: number): string {
		const t = this.theme;
		const label = fg(t.dim, pad(f.label, LABEL_W));
		const vw = Math.max(1, CW - LABEL_W);
		if (this.editing && selected) return label + (this.editing.render(vw)[0] ?? "");
		let shown = (this.values[f.id] ?? "") || "—";
		if (f.kind === "enum" && selected) shown = `‹ ${shown} ›`;
		return label + fg(selected ? t.fg : t.muted, pad(shown, vw));
	}

	private buttons(): string {
		const t = this.theme;
		const fields = this.fields();
		const save = this.sel === fields.length ? bold(fg(t.green, "[ ✔ Save node ]")) : fg(t.muted, "  ✔ Save node  ");
		const cancel = this.sel === fields.length + 1 ? bold(fg(t.red, "[ ✗ Cancel ]")) : fg(t.muted, "  ✗ Cancel  ");
		return `${save}   ${cancel}`;
	}
}
