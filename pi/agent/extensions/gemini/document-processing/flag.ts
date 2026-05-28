import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showForm, type FormField } from "../lib/form";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "genai-core/models";
import { applyAliases, parseSubflags } from "../lib/parse";
import { processDocument } from "genai-core/document-processing/core";

const DOC_REF = /(\S+\.(?:pdf|txt|md|html|xml))/i;

/** Pull a document path out of free text; the rest is the instruction. */
function splitRef(text: string): { file: string; question: string } {
  const match = text.match(DOC_REF);
  if (!match) return { file: "", question: text.trim() };
  return { file: match[0], question: text.replace(match[0], "").trim() };
}

const FIELDS: FormField[] = [
  { id: "file", label: "Document path", kind: "text" },
  { id: "prompt", label: "Instruction", kind: "text" },
  { id: "model", label: "Model", kind: "enum", values: [...TEXT_MODELS] },
  { id: "json", label: "JSON output", kind: "bool" },
  { id: "schema", label: "JSON schema (raw, optional)", kind: "text" },
  { id: "systemInstruction", label: "System instruction (optional)", kind: "text" },
  { id: "thinkingBudget", label: "Thinking budget (blank/auto/off/tokens)", kind: "text" },
];

const ALIASES: Record<string, string> = {
  file: "file", prompt: "prompt", model: "model", json: "json",
  schema: "schema", system: "systemInstruction", thinking: "thinkingBudget",
};

/** `--gemini-document-processing [file] [instruction] [--model --json --schema --system --thinking]`. */
export function registerDocumentFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-document-processing",
    description: "Process a PDF/document with Gemini (subflags: --model --json --schema --system --thinking)",
    handle: async (raw, ctx) => {
      const { positional, opts } = parseSubflags(raw, ["json"]);
      const ref = splitRef(positional);
      const file = opts.file || ref.file || (await ctx.ui.input("Document path", "")) || "";
      if (!file.trim()) { ctx.ui.notify("Cancelled: no document provided.", "warning"); return; }

      const initial = applyAliases(
        {
          file, prompt: ref.question || "Summarize this document in 5 bullets.",
          model: TEXT_MODELS[0], json: "false", schema: "", systemInstruction: "", thinkingBudget: "",
        },
        opts,
        ALIASES,
      );
      const values = await showForm(ctx, "Gemini: Process Document", FIELDS, initial, "▶ Process");
      if (!values) { ctx.ui.notify("Cancelled.", "info"); return; }
      if (!values.file.trim()) { ctx.ui.notify("Document path is empty.", "warning"); return; }

      ctx.ui.notify("Processing document with Gemini…", "info");
      const result = await processDocument(
        {
          file: values.file.trim(), prompt: values.prompt || "Summarize this document.",
          model: values.model, json: values.json === "true", schema: values.schema,
          systemInstruction: values.systemInstruction, thinkingBudget: values.thinkingBudget,
        },
        ctx.cwd,
      );
      sendText(pi, result.text, `Document · ${result.path}`);
    },
  });
}
