import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { openExternally } from "../lib/open";
import { generateImage } from "./core";
import { showImageForm } from "./form";
import { IMAGE_MESSAGE_TYPE, type GeneratedImageDetails } from "./types";

/** `--gemini-generate-image [prompt]` — intercepted, opens the review form. */
export function registerImageFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-generate-image",
    description: "Generate an image with Gemini",
    handle: async (prompt, ctx) => {
      const initial = prompt || (await ctx.ui.input("Image prompt", "a nano banana dish in a fancy restaurant")) || "";
      if (!initial.trim()) { ctx.ui.notify("Cancelled: empty prompt.", "warning"); return; }

      const form = await showImageForm(ctx, initial);
      if (!form) { ctx.ui.notify("Cancelled.", "info"); return; }
      if (!form.prompt) { ctx.ui.notify("Prompt is empty.", "warning"); return; }

      ctx.ui.notify(`Generating with ${form.model} (${form.aspectRatio}, ${form.imageSize})…`, "info");
      const details = await generateImage(form, ctx.cwd);
      pi.sendMessage<GeneratedImageDetails>({
        customType: IMAGE_MESSAGE_TYPE,
        content: `Generated image: ${details.path}`,
        display: true,
        details,
      });
      openExternally(pi, details.path).catch(() => {});
    },
  });
}
