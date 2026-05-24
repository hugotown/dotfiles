/**
 * Model + agent catalogs per task (consolidates gemini-common model picker).
 * First entry of each list is the default.
 */
export const IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

export const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview"] as const;

export const RESEARCH_AGENTS = [
  "deep-research-preview-04-2026",
  "deep-research-pro-preview-12-2025",
  "deep-research-max-preview-04-2026",
] as const;

export const ASPECT_RATIOS = [
  "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
] as const;

export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
