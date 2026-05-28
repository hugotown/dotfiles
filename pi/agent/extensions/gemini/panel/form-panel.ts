// Interactive overlay form for the Gemini flags. Replaces the old SettingsList form:
// owns selection + keyboard behavior over [fields…, accept, cancel]; rendering (the
// bordered card) lives in render.ts. Enum/bool fields cycle in place; text/number open
// an inline editor. Results flow out via onDone (values on Accept, null on Cancel).
import { type Component, Input, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { FormField, FormValues } from "../lib/form";
import type { KeymapConfig } from "../lib/keymap";
import type { ThemeColors } from "../lib/theme";
import { renderForm } from "./render";

export class FormPanel implements Component {
  private readonly values: FormValues;
  private sel = 0;
  private editing: Input | null = null;
  private heightFrac = 0.8; // card height as a fraction of terminal rows (matches the overlay)
  private rowsFn: () => number = () => process.stdout.rows ?? 24; // reliable rows via tui.terminal

  /** Body-height fraction; MUST match the overlay maxHeight so the card fills it exactly. */
  setHeightFrac(frac: number): void { this.heightFrac = frac; }
  /** Provide the real terminal row count (tui.terminal.rows) — more reliable than stdout. */
  setRowsFn(fn: () => number): void { this.rowsFn = fn; }

  constructor(
    private readonly title: string,
    private readonly fields: FormField[],
    initial: FormValues,
    private readonly runLabel: string,
    private readonly keymap: KeymapConfig,
    private readonly theme: ThemeColors,
    private readonly onDone: (v: FormValues | null) => void,
    private readonly onChange: () => void,
  ) {
    this.values = { ...initial };
  }

  private get acceptIdx(): number { return this.fields.length; }
  private get cancelIdx(): number { return this.fields.length + 1; }
  private hits(d: string, ids: string[]): boolean { return ids.some((k) => matchesKey(d, k as KeyId)); }

  handleInput(data: string): void {
    if (this.editing) { this.editing.handleInput(data); return this.onChange(); }
    const { up, down, prev, next, edit, cancel } = this.keymap.nav;
    const rows = this.fields.length + 2;
    if (this.hits(data, cancel)) return this.onDone(null);
    if (this.hits(data, up)) { this.sel = (this.sel - 1 + rows) % rows; return this.onChange(); }
    if (this.hits(data, down)) { this.sel = (this.sel + 1) % rows; return this.onChange(); }
    if (this.sel === this.acceptIdx) { if (this.hits(data, edit)) this.onDone({ ...this.values }); return; }
    if (this.sel === this.cancelIdx) { if (this.hits(data, edit)) this.onDone(null); return; }

    const field = this.fields[this.sel];
    if (field.kind === "enum" || field.kind === "bool") {
      const opts = field.kind === "bool" ? ["false", "true"] : field.values ?? [];
      if (!opts.length) return;
      const cur = Math.max(0, opts.indexOf(this.values[field.id] ?? opts[0]));
      if (this.hits(data, prev)) this.values[field.id] = opts[(cur - 1 + opts.length) % opts.length];
      else if (this.hits(data, next) || this.hits(data, edit)) this.values[field.id] = opts[(cur + 1) % opts.length];
      else return;
      return this.onChange();
    }
    if (this.hits(data, edit)) this.startEdit(field);
  }

  private startEdit(field: FormField): void {
    const input = new Input();
    input.setValue(this.values[field.id] ?? ""); input.focused = true;
    input.onSubmit = (raw) => {
      const v = field.coerce ? field.coerce(raw) : raw;
      if (v !== null) this.values[field.id] = v;
      this.editing = null; this.onChange();
    };
    input.onEscape = () => { this.editing = null; this.onChange(); };
    this.editing = input; this.onChange();
  }

  invalidate(): void {}

  render(width: number): string[] {
    const targetHeight = Math.max(8, Math.floor(this.rowsFn() * this.heightFrac));
    return renderForm({
      title: this.title, fields: this.fields, values: this.values,
      sel: this.sel, runLabel: this.runLabel, editing: this.editing,
      theme: this.theme, width, targetHeight,
    });
  }
}
