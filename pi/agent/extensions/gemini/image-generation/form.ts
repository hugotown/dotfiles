import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { showForm, type FormField, type FormValues } from "../lib/form";
import { ASPECT_RATIOS, IMAGE_MODELS, IMAGE_SIZES } from "../lib/models";
import { defaultForm, type ImageForm } from "./types";

/** Subflag key → form field id (for `--gemini-generate-image "x" --size 4k …`). */
export const IMAGE_ALIASES: Record<string, string> = {
  model: "model",
  aspect: "aspectRatio", "aspect-ratio": "aspectRatio",
  size: "imageSize", "image-size": "imageSize",
  temp: "temperature", temperature: "temperature",
  seed: "seed",
};

const FIELDS: FormField[] = [
  { id: "prompt", label: "Prompt", kind: "text" },
  { id: "model", label: "Model", kind: "enum", values: [...IMAGE_MODELS] },
  { id: "aspectRatio", label: "Aspect ratio", kind: "enum", values: [...ASPECT_RATIOS] },
  { id: "imageSize", label: "Image size", kind: "enum", values: [...IMAGE_SIZES] },
  {
    id: "temperature", label: "Temperature (0-2)", kind: "number",
    coerce: (raw) => { const n = Number(raw); return Number.isFinite(n) && n >= 0 && n <= 2 ? String(n) : null; },
  },
  {
    id: "seed", label: "Seed (int or 'null')", kind: "number",
    coerce: (raw) => { const t = raw.trim(); if (!t || t === "null") return "null"; return Number.isInteger(Number(t)) ? t : null; },
  },
];

function defaults(prompt: string): FormValues {
  const f = defaultForm(prompt);
  return {
    prompt: f.prompt, model: f.model, aspectRatio: f.aspectRatio,
    imageSize: f.imageSize, temperature: String(f.temperature), seed: "null",
  };
}

/** Normalize loose subflag values (e.g. `--size 4k` → "4K") onto the defaults. */
export function initialFrom(prompt: string, overrides: FormValues): FormValues {
  const state = { ...defaults(prompt), ...overrides };
  if (state.imageSize) {
    const up = state.imageSize.toUpperCase();
    state.imageSize = (IMAGE_SIZES as readonly string[]).includes(up) ? up : defaults(prompt).imageSize;
  }
  return state;
}

function toImageForm(v: FormValues): ImageForm {
  const seed = v.seed === "null" || !v.seed ? null : Number(v.seed);
  return {
    prompt: v.prompt.trim(),
    model: v.model,
    aspectRatio: v.aspectRatio,
    imageSize: v.imageSize,
    temperature: Number(v.temperature),
    seed: Number.isInteger(seed as number) ? (seed as number) : null,
  };
}

export async function showImageForm(ctx: ExtensionContext, initial: FormValues): Promise<ImageForm | null> {
  const values = await showForm(ctx, "Generate image with Gemini", FIELDS, initial, "▶ Generate image");
  return values ? toImageForm(values) : null;
}
