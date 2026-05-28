/** gemini-document-processing core: PDF/doc + prompt → text or JSON. */
import { createPartFromUri, createUserContent } from "@google/genai";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { buildTextGenConfig } from "../config";
import { getClient } from "../client";
import { outputPath, saveText } from "../output";

const INLINE_LIMIT = 10 * 1024 * 1024; // ≥10 MB → File API; else inline bytes.

const DOC_MIME: Record<string, string> = {
  ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown",
  ".html": "text/html", ".xml": "application/xml",
};

function mimeForDoc(path: string): string {
  return DOC_MIME[extname(path).toLowerCase()] ?? "application/pdf";
}

export interface DocInput {
  file: string;
  prompt: string;
  model: string;
  json: boolean;
  schema?: string;
  systemInstruction?: string;
  thinkingBudget?: string | number;
}
export interface DocResult { text: string; path: string; }

/** Build `contents`: inline for small files, File API upload for large ones. */
async function buildContents(ai: ReturnType<typeof getClient>, file: string, prompt: string) {
  const mimeType = mimeForDoc(file);
  const bytes = readFileSync(file);
  if (bytes.length < INLINE_LIMIT) {
    return [{ inlineData: { mimeType, data: bytes.toString("base64") } }, prompt];
  }
  const uploaded = await ai.files.upload({ file, config: { mimeType } });
  return createUserContent([createPartFromUri(uploaded.uri ?? "", mimeType), prompt]);
}

export async function processDocument(input: DocInput, cwd: string): Promise<DocResult> {
  const ai = getClient();
  const contents = await buildContents(ai, input.file, input.prompt);
  const config = buildTextGenConfig({
    json: input.json,
    schema: input.schema,
    systemInstruction: input.systemInstruction,
    thinkingBudget: input.thinkingBudget,
  });
  const response = await ai.models.generateContent({
    model: input.model,
    contents,
    ...(Object.keys(config).length ? { config } : {}),
  });
  const text = response.text ?? "";
  if (!text.trim()) throw new Error("Empty response from Gemini for this document.");
  const path = saveText(outputPath(cwd, "documents", input.prompt || "document", input.json ? "json" : "md"), text);
  return { text, path };
}
