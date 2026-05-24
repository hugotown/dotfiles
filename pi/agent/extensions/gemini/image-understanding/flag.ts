import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "../lib/models";
import { analyzeImage } from "./core";

const IMAGE_REF = /(https?:\/\/\S+|\S+\.(?:png|jpe?g|webp|heic|heif))/i;

/** Pull an image path/URL out of free text; the rest is the question. */
function splitRef(text: string): { image: string; question: string } {
  const match = text.match(IMAGE_REF);
  if (!match) return { image: "", question: text.trim() };
  return { image: match[0], question: text.replace(match[0], "").trim() };
}

/** `--gemini-image-understanding [image] [question]` — hybrid ask-vs-direct. */
export function registerUnderstandingFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-image-understanding",
    description: "Analyze an image with Gemini (caption, OCR, detect, classify)",
    handle: async (prompt, ctx) => {
      const ref = splitRef(prompt);
      const image = ref.image || (await ctx.ui.input("Image path or URL", "")) || "";
      if (!image.trim()) { ctx.ui.notify("Cancelled: no image provided.", "warning"); return; }
      const question = ref.question || (await ctx.ui.input("What should I analyze?", "Describe this image in detail.")) || "Describe this image in detail.";

      ctx.ui.notify("Analyzing image with Gemini…", "info");
      const result = await analyzeImage({ image, prompt: question, model: TEXT_MODELS[0], json: false }, ctx.cwd);
      sendText(pi, result.text, `Vision · ${result.path}`);
    },
  });
}
