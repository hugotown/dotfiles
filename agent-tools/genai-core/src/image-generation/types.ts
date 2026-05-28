import { IMAGE_MODELS } from "../models";

export interface GeneratedImageDetails {
  path: string;
  base64: string;
  mimeType: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
}

export interface ImageForm {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  temperature: number;
  seed: number | null;
}

export function defaultForm(prompt: string): ImageForm {
  return { prompt, model: IMAGE_MODELS[0], aspectRatio: "16:9", imageSize: "1K", temperature: 1.0, seed: null };
}
