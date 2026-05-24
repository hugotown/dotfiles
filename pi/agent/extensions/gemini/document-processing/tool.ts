import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TEXT_MODELS } from "../lib/models";
import { processDocument } from "./core";

/** LLM-callable surface for document processing. */
export function registerDocumentTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_process_document",
    label: "Gemini: Process Document",
    description:
      "Process a local PDF or document with Gemini (summarize, extract, compare, OCR, answer questions). Native PDF vision reads text, tables, and charts. Saves output to gemini-output/documents/.",
    parameters: Type.Object({
      file: Type.String({ description: "Local path to a .pdf/.txt/.md/.html/.xml file" }),
      prompt: Type.String({ description: "Instruction: 'summarize in 5 bullets', 'extract line items as JSON', etc." }),
      model: Type.Optional(StringEnum(TEXT_MODELS, { default: TEXT_MODELS[0] })),
      json: Type.Optional(Type.Boolean({ description: "Return structured JSON. Prefer gemini-2.5-pro for strict schemas.", default: false })),
    }),
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const result = await processDocument(
        { file: p.file, prompt: p.prompt, model: p.model ?? TEXT_MODELS[0], json: p.json ?? false },
        ctx.cwd,
      );
      return {
        content: [{ type: "text" as const, text: result.text }],
        details: { path: result.path },
      };
    },
  });
}
