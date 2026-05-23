import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const WORKFLOW_TOKEN = "--gemini-generate-image";
export const IMAGE_MESSAGE_TYPE = "gemini-generated-image";

export const ASPECT_RATIOS = [
  "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
] as const;
export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export const MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

export interface GeneratedImageDetails {
  path: string;
  base64: string;
  mimeType: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
}

export interface FormValues {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  temperature: number;
  seed: number | null;
  outputDir: string;
}

export function defaultForm(prompt: string): FormValues {
  return {
    prompt,
    model: MODELS[0],
    aspectRatio: "16:9",
    imageSize: "1K",
    temperature: 1.0,
    seed: null,
    outputDir: "gemini-output",
  };
}
