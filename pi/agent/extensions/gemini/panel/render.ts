// Pure renderer for the Gemini flag form: draws a bordered, opaque Tokyo-Night card —
// rounded frame with the title in the top border, one padded row per field, a divider,
// and two buttons. Returns full-width lines (border to border). Kept free of state so
// FormPanel owns behavior and this owns pixels. Only fg() is used inside a row, so the
// single bg() wrap per row stays opaque (bg reset would otherwise punch holes).
import type { Input } from "@earendil-works/pi-tui";
import type { FormField, FormValues } from "../lib/form";
import type { ThemeColors } from "../lib/theme";
import { bg, bold, fg, pad } from "../lib/palette";

const LABEL_W = 16;

export interface RenderState {
  title: string;
  fields: FormField[];
  values: FormValues;
  sel: number;
  runLabel: string;
  editing: Input | null;
  theme: ThemeColors;
  width: number;
  /** Total rows the card must occupy so it fills the overlay (derived from terminal rows). */
  targetHeight: number;
}

export function renderForm(s: RenderState): string[] {
  const t = s.theme;
  const W = Math.max(28, s.width);
  const CW = W - 4; // visible content width between "│ " and " │"
  const frame = (ch: string) => bg(t.panelBg, fg(t.dim, ch));
  const row = (content: string, rowBg: string) => frame("│") + bg(rowBg, ` ${content} `) + frame("│");
  const blank = row(" ".repeat(CW), t.panelBg);

  const out = [topBorder(s.title, W, t), blank];
  s.fields.forEach((f, i) => out.push(row(fieldContent(f, i === s.sel, CW, s), i === s.sel ? t.selectedBg : t.panelBg)));
  out.push(blank);
  // Footer is anchored to the bottom border; blank rows in between grow the opaque card to
  // exactly targetHeight so it fills the overlay (no floating short panel, no internal margins).
  const footer = [
    bg(t.panelBg, fg(t.dim, `├${"─".repeat(W - 2)}┤`)),
    row(buttons(CW, s), t.panelBg),
    blank,
    bg(t.panelBg, fg(t.dim, `╰${"─".repeat(W - 2)}╯`)),
  ];
  const fill = Math.max(0, s.targetHeight - out.length - footer.length);
  for (let i = 0; i < fill; i++) out.push(blank);
  out.push(...footer);
  return out;
}

function topBorder(title: string, W: number, t: ThemeColors): string {
  const max = W - 4;
  const tt = title.length > max ? `${title.slice(0, max - 1)}… ` : ` ${title} `;
  const dashes = Math.max(0, W - 3 - tt.length);
  return bg(t.panelBg, fg(t.dim, "╭─") + bold(fg(t.blue, tt)) + fg(t.dim, `${"─".repeat(dashes)}╮`));
}

function fieldContent(f: FormField, selected: boolean, CW: number, s: RenderState): string {
  const t = s.theme;
  const label = fg(t.dim, pad(f.label, LABEL_W));
  const vw = Math.max(1, CW - LABEL_W);
  if (s.editing && selected) return label + (s.editing.render(vw)[0] ?? "");
  let shown = (s.values[f.id] ?? "") || "—";
  if ((f.kind === "enum" || f.kind === "bool") && selected) shown = `‹ ${shown} ›`;
  return label + fg(selected ? t.fg : t.muted, pad(shown, vw));
}

function buttons(CW: number, s: RenderState): string {
  const t = s.theme;
  const accept = s.sel === s.fields.length;
  const cancel = s.sel === s.fields.length + 1;
  const a = accept ? bold(fg(t.green, `[ ${s.runLabel} ]`)) : fg(t.muted, `  ${s.runLabel}  `);
  const c = cancel ? bold(fg(t.red, "[ ✗ Cancel ]")) : fg(t.muted, "  ✗ Cancel  ");
  const fill = Math.max(0, CW - (s.runLabel.length + 4) - 3 - ("✗ Cancel".length + 4));
  return `${a}   ${c}${" ".repeat(fill)}`;
}
