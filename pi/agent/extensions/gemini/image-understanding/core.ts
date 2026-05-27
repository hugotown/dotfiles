/** gemini-image-understanding core: analyze an image (caption/OCR/detect/classify). */
import { buildTextGenConfig } from "../lib/config";
import { getClient } from "../lib/client";
import { outputPath, saveText } from "../lib/output";
import { loadImagePart } from "./load";

export interface AnalyzeInput {
  image: string; // local path or http(s) URL
  prompt: string;
  model: string;
  json: boolean; // structured JSON output (detection/extraction)
  schema?: string;
  systemInstruction?: string;
  thinkingBudget?: string | number;
}

export interface AnalyzeResult {
  text: string;
  path: string;
}

export async function analyzeImage(input: AnalyzeInput, cwd: string): Promise<AnalyzeResult> {
  const ai = getClient();
  const part = await loadImagePart(input.image);
  const config = buildTextGenConfig({
    json: input.json,
    schema: input.schema,
    systemInstruction: input.systemInstruction,
    thinkingBudget: input.thinkingBudget,
  });
  const response = await ai.models.generateContent({
    model: input.model,
    contents: [part, input.prompt],
    ...(Object.keys(config).length ? { config } : {}),
  });

  const text = response.text ?? "";
  if (!text.trim()) {
    throw new Error("Empty response from Gemini vision. Try gemini-2.5-pro or a clearer prompt.");
  }
  const path = saveText(outputPath(cwd, "vision", input.prompt || "analysis", input.json ? "json" : "md"), text);
  return { text, path };
}
