import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { applyAliases, parseSubflags } from "../lib/parse";
import { openExternally } from "../lib/open";
import { generateImage } from "genai-core/image-generation/core";
import { IMAGE_ALIASES, initialFrom, showImageForm } from "./form";
import { sendText } from "../lib/message";

/**
 * `--gemini-generate-image [prompt] [--model … --aspect 9:16 --size 4k --temp … --seed …]`
 * Parses inline subflags, pre-fills the review form, and generates on confirm.
 */
export function registerImageFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-generate-image",
    description: "Generate an image with Gemini (subflags: --model --aspect --size --temp --seed)",
    handle: async (raw, ctx) => {
      const { positional, opts } = parseSubflags(raw);
      const prompt = positional || (await ctx.ui.input("Image prompt", "a nano banana dish in a fancy restaurant")) || "";
      if (!prompt.trim()) { ctx.ui.notify("Cancelled: empty prompt.", "warning"); return; }

      const initial = initialFrom(prompt, applyAliases({}, opts, IMAGE_ALIASES));
      const form = await showImageForm(ctx, initial);
      if (!form) { ctx.ui.notify("Cancelled.", "info"); return; }
      if (!form.prompt) { ctx.ui.notify("Prompt is empty.", "warning"); return; }

      ctx.ui.notify(`Generating with ${form.model} (${form.aspectRatio}, ${form.imageSize})…`, "info");
      const details = await generateImage(form, ctx.cwd);
      sendText(pi, `Generated image: ${details.path}`, `Image · ${details.model} · ${details.aspectRatio} · ${details.imageSize}`);
      openExternally(details.path);
    },
  });
}
