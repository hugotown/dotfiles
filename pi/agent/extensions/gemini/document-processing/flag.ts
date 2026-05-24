import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "../lib/models";
import { processDocument } from "./core";

const DOC_REF = /(\S+\.(?:pdf|txt|md|html|xml))/i;

function splitRef(text: string): { file: string; question: string } {
  const match = text.match(DOC_REF);
  if (!match) return { file: "", question: text.trim() };
  return { file: match[0], question: text.replace(match[0], "").trim() };
}

/** `--gemini-document-processing [file] [instruction]` — hybrid ask-vs-direct. */
export function registerDocumentFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-document-processing",
    description: "Process a PDF/document with Gemini (summarize, extract, compare)",
    handle: async (prompt, ctx) => {
      const ref = splitRef(prompt);
      const file = ref.file || (await ctx.ui.input("Document path", "")) || "";
      if (!file.trim()) { ctx.ui.notify("Cancelled: no document provided.", "warning"); return; }
      const question = ref.question || (await ctx.ui.input("What should I do with it?", "Summarize this document in 5 bullets.")) || "Summarize this document.";

      ctx.ui.notify("Processing document with Gemini…", "info");
      const result = await processDocument({ file, prompt: question, model: TEXT_MODELS[0], json: false }, ctx.cwd);
      sendText(pi, result.text, `Document · ${result.path}`);
    },
  });
}
