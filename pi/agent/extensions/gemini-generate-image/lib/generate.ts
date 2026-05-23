import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FormValues, GeneratedImageDetails } from "./types";

export function resolveApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing API key: set GEMINI_API_KEY or GOOGLE_API_KEY in your shell environment.",
    );
  }
  return apiKey;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
}

export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": case "image/jpg": return ".jpg";
    case "image/webp": return ".webp";
    case "image/gif": return ".gif";
    case "image/png": default: return ".png";
  }
}

export async function generate(form: FormValues, cwd: string): Promise<GeneratedImageDetails> {
  const ai = new GoogleGenAI({ apiKey: resolveApiKey() });
  const response = await ai.models.generateContent({
    model: form.model,
    contents: form.prompt,
    config: {
      responseModalities: ["IMAGE"],
      temperature: form.temperature,
      ...(form.seed !== null ? { seed: form.seed } : {}),
      imageConfig: { aspectRatio: form.aspectRatio, imageSize: form.imageSize },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (inline?.data) {
      const mimeType = inline.mimeType ?? "image/png";
      const outDirAbs = resolve(cwd, form.outputDir);
      mkdirSync(outDirAbs, { recursive: true });
      const fileName = `${Date.now()}-${slugify(form.prompt)}${extensionFor(mimeType)}`;
      const outPath = join(outDirAbs, fileName);
      writeFileSync(outPath, Buffer.from(inline.data, "base64"));
      return {
        path: outPath, base64: inline.data, mimeType,
        model: form.model, aspectRatio: form.aspectRatio, imageSize: form.imageSize,
      };
    }
  }
  throw new Error(diagnoseEmptyResponse(response));
}

function diagnoseEmptyResponse(response: unknown): string {
  const r = response as {
    promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
      safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
    }>;
  };

  const promptBlock = r.promptFeedback?.blockReason;
  if (promptBlock) {
    const detail = r.promptFeedback?.blockReasonMessage;
    return `Prompt blocked by safety filter (${promptBlock})${detail ? `: ${detail}` : ""}.`;
  }

  const candidate = r.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const textParts = candidate?.content?.parts?.map((p) => p.text).filter((t): t is string => !!t) ?? [];
  const modelText = textParts.join(" ").trim();

  if (finishReason && finishReason !== "STOP") {
    const blockedRatings = (candidate?.safetyRatings ?? [])
      .filter((r) => r.blocked || r.probability === "HIGH")
      .map((r) => `${r.category}=${r.probability}`).join(", ");
    const safetyHint = blockedRatings ? ` Safety: ${blockedRatings}.` : "";
    const textHint = modelText ? ` Model said: "${modelText.slice(0, 200)}".` : "";
    return `Generation stopped (${finishReason}).${safetyHint}${textHint}`;
  }

  if (modelText) return `Model returned text instead of an image: "${modelText.slice(0, 300)}"`;
  return "Empty response from Gemini. Try a different model, simpler prompt, or retry.";
}
