/**
 * Declarative review form shared by every gemini flag. Modules declare fields;
 * showForm opens them as an opaque overlay panel (panel/form-panel.ts) pre-filled
 * with `initial`, and returns the collected values (all strings) on Accept — null on
 * Cancel. Values stay strings here; modules coerce to numbers/JSON when calling the API.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FormPanel } from "../panel/form-panel";
import { getConfig } from "./settings";

export type FieldKind = "text" | "number" | "enum" | "bool";

export interface FormField {
  id: string;
  label: string;
  kind: FieldKind;
  /** Options for enum fields. */
  values?: string[];
  /** Validate/normalize text & number input; return null to reject (keep prior). */
  coerce?: (raw: string) => string | null;
}

export type FormValues = Record<string, string>;

export async function showForm(
  ctx: ExtensionContext,
  title: string,
  fields: FormField[],
  initial: FormValues,
  runLabel = "▶ Run",
): Promise<FormValues | null> {
  const { keymap, theme, panel } = getConfig();
  // Card height fraction MUST match the overlay maxHeight so the content fills it exactly
  // (otherwise the panel floats short, with internal margins). Both derive from this number.
  const heightFrac =
    typeof panel.maxHeight === "string" && panel.maxHeight.endsWith("%")
      ? Math.max(0.2, Number.parseFloat(panel.maxHeight) / 100)
      : 0.8;
  return ctx.ui.custom<FormValues | null>(
    (tui, _theme, _kb, done) => {
      // On close, force a full-clear redraw. hideOverlay only schedules a THROTTLED
      // render, which batches with the output the handler appends next (notify/message);
      // that batch grows the content, skipping pi's shrink-clear, so a stale top border
      // can linger over scrollback. The forced redraw runs on process.nextTick — before
      // the handler's resolve microtask — repainting clean while the overlay is already
      // gone and the new output not yet emitted.
      const close = (v: FormValues | null) => { done(v); tui.requestRender(true); };
      const formPanel = new FormPanel(title, fields, initial, runLabel, keymap, theme, close, () => tui.requestRender());
      formPanel.setRowsFn(() => tui.terminal?.rows || process.stdout.rows || 24);
      formPanel.setHeightFrac(heightFrac);
      return formPanel;
    },
    { overlay: true, overlayOptions: { ...panel, anchor: "center" } },
  );
}
