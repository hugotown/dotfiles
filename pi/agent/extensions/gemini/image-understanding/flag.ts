import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showForm, type FormField } from "../lib/form";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "genai-core/models";
import { applyAliases, parseSubflags } from "../lib/parse";
import { analyzeImage } from "genai-core/image-understanding/core";

const IMAGE_REF = /(https?:\/\/\S+|\S+\.(?:png|jpe?g|webp|heic|heif))/i;

/** Pull an image path/URL out of free text; the rest is the question. */
function splitRef(text: string): { image: string; question: string } {
  const match = text.match(IMAGE_REF);
  if (!match) return { image: "", question: text.trim() };
  return { image: match[0], question: text.replace(match[0], "").trim() };
}

const FIELDS: FormField[] = [
  { id: "image", label: "Image path or URL", kind: "text" },
  { id: "prompt", label: "Question", kind: "text" },
  { id: "model", label: "Model", kind: "enum", values: [...TEXT_MODELS] },
  { id: "json", label: "JSON output", kind: "bool" },
  { id: "schema", label: "JSON schema (raw, optional)", kind: "text" },
  { id: "systemInstruction", label: "System instruction (optional)", kind: "text" },
  { id: "thinkingBudget", label: "Thinking budget (blank/auto/off/tokens)", kind: "text" },
];

const ALIASES: Record<string, string> = {
  image: "image", prompt: "prompt", model: "model", json: "json",
  schema: "schema", system: "systemInstruction", thinking: "thinkingBudget",
};

/** `--gemini-image-understanding [image] [question] [--model --json --schema --system --thinking]`. */
export function registerUnderstandingFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-image-understanding",
    description: "Analyze an image with Gemini (subflags: --model --json --schema --system --thinking)",
    handle: async (raw, ctx) => {
      const { positional, opts } = parseSubflags(raw, ["json"]);
      const ref = splitRef(positional);
      const image = opts.image || ref.image || (await ctx.ui.input("Image path or URL", "")) || "";
      if (!image.trim()) { ctx.ui.notify("Cancelled: no image provided.", "warning"); return; }

      const initial = applyAliases(
        {
          image, prompt: ref.question || "Describe this image in detail.",
          model: TEXT_MODELS[0], json: "false", schema: "", systemInstruction: "", thinkingBudget: "",
        },
        opts,
        ALIASES,
      );
      const values = await showForm(ctx, "Gemini: Analyze Image", FIELDS, initial, "▶ Analyze");
      if (!values) { ctx.ui.notify("Cancelled.", "info"); return; }
      if (!values.image.trim()) { ctx.ui.notify("Image path is empty.", "warning"); return; }

      ctx.ui.notify("Analyzing image with Gemini…", "info");
      const result = await analyzeImage(
        {
          image: values.image.trim(), prompt: values.prompt || "Describe this image in detail.",
          model: values.model, json: values.json === "true", schema: values.schema,
          systemInstruction: values.systemInstruction, thinkingBudget: values.thinkingBudget,
        },
        ctx.cwd,
      );
      sendText(pi, result.text, `Vision · ${result.path}`);
    },
  });
}
