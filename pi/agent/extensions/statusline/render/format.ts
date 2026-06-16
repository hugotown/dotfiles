import type { CatalogModel } from "../types";
import { CAPABILITY_ICONS } from "./icons";

export function formatPrice(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "?";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function formatTokenLimit(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "?";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function hasImage(m: CatalogModel): boolean {
  return Boolean(m.attachment) && Array.isArray(m.modalities?.input) && (m.modalities!.input as string[]).includes("image");
}
function hasPdf(m: CatalogModel): boolean {
  return Array.isArray(m.modalities?.input) && (m.modalities!.input as string[]).includes("pdf");
}
function hasVideo(m: CatalogModel): boolean {
  return Array.isArray(m.modalities?.input) && (m.modalities!.input as string[]).includes("video");
}
function hasGenericFiles(m: CatalogModel): boolean {
  return Boolean(m.attachment) && !hasImage(m) && !hasPdf(m);
}

// Order is intentional and stable: input modalities first (text → image → files → pdf → video),
// then behavioral capabilities (reasoning → tools). `tools` is last because it is
// transversal to modalities and benefits from being the rightmost anchor in the line.
// activeLabels() must mirror this order so icons and labels align by index.
export function activeIcons(model: CatalogModel): string[] {
  const out: string[] = [];
  out.push(CAPABILITY_ICONS.text); // text always present per design decision
  if (hasImage(model)) out.push(CAPABILITY_ICONS.image);
  if (hasGenericFiles(model)) out.push(CAPABILITY_ICONS.files);
  if (hasPdf(model)) out.push(CAPABILITY_ICONS.pdf);
  if (hasVideo(model)) out.push(CAPABILITY_ICONS.video);
  if (model.reasoning) out.push(CAPABILITY_ICONS.reasoning);
  if (model.tool_call) out.push(CAPABILITY_ICONS.tools);
  return out;
}

export function activeLabels(model: CatalogModel): string[] {
  const out: string[] = [];
  out.push("text");
  if (hasImage(model)) out.push("image");
  if (hasGenericFiles(model)) out.push("files");
  if (hasPdf(model)) out.push("pdf");
  if (hasVideo(model)) out.push("video");
  if (model.reasoning) out.push("reasoning");
  if (model.tool_call) out.push("tools");
  return out;
}

export function formatKnowledge(model: CatalogModel): string {
  return model.knowledge ? `knowledge ${model.knowledge}` : "";
}
