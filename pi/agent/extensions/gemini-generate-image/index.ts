/**
 * pi-tool-gemini-generate-image — Extension entry point.
 *
 * Lets the user generate an image with Gemini via:
 *     <prompt> --gemini-generate-image
 *
 * Zero LLM token cost — only the Gemini image-generation API is called.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, getImageDimensions, Image, Text } from "@earendil-works/pi-tui";
import { WORKFLOW_TOKEN, IMAGE_MESSAGE_TYPE, type GeneratedImageDetails } from "./lib/types";
import { resolveApiKey, generate } from "./lib/generate";
import { openImageExternally } from "./lib/image-helpers";
import { showForm } from "./lib/form";

export default function (pi: ExtensionAPI) {
  // Register inline-image renderer for the conversation transcript
  pi.registerMessageRenderer<GeneratedImageDetails>(IMAGE_MESSAGE_TYPE, (message, _options, theme) => {
    const details = message.details;
    if (!details) return undefined;
    const dimensions = getImageDimensions(details.base64, details.mimeType);
    const container = new Container();
    container.addChild(
      new Text(theme.fg("accent", `✓ Generated · ${details.model} · ${details.aspectRatio} · ${details.imageSize}`)),
    );
    container.addChild(new Text(theme.fg("dim", details.path)));
    if (dimensions) {
      container.addChild(
        new Image(details.base64, details.mimeType,
          { fallbackColor: (s) => theme.fg("muted", s) },
          { maxHeightCells: 30, filename: details.path }, dimensions),
      );
    } else {
      container.addChild(new Text(theme.fg("warning", "(image dimensions unavailable, open the file directly)")));
    }
    return container;
  });

  pi.registerFlag("gemini-generate-image", { description: "Generate an image with Gemini", type: "string" });
  pi.events.emit("flag:registered", { token: WORKFLOW_TOKEN, description: "Generate an image with Gemini" });

  pi.on("input", async (event, ctx) => {
    if (!event.text.includes(WORKFLOW_TOKEN)) return { action: "continue" };
    const cleanedPrompt = event.text.split(WORKFLOW_TOKEN).join("").trim();

    if (!ctx.hasUI) {
      ctx.ui.notify(`${WORKFLOW_TOKEN} requires interactive UI.`, "error");
      return { action: "handled" };
    }

    try { resolveApiKey(); } catch (err) {
      ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
      return { action: "handled" };
    }

    const initialPrompt =
      cleanedPrompt || (await ctx.ui.input("Image prompt", "a nano banana dish in a fancy restaurant")) || "";
    if (!initialPrompt.trim()) {
      ctx.ui.notify("Cancelled: empty prompt.", "warning");
      return { action: "handled" };
    }

    const form = await showForm(ctx, initialPrompt);
    if (!form) { ctx.ui.notify("Cancelled.", "info"); return { action: "handled" }; }
    if (!form.prompt) { ctx.ui.notify("Prompt is empty.", "warning"); return { action: "handled" }; }

    ctx.ui.notify(`Generating image with ${form.model} (${form.aspectRatio}, ${form.imageSize})…`, "info");
    try {
      const details = await generate(form, ctx.cwd);
      pi.sendMessage<GeneratedImageDetails>({
        customType: IMAGE_MESSAGE_TYPE,
        content: `Generated image: ${details.path}`,
        display: true,
        details,
      });
      openImageExternally(pi, details.path).catch(() => {});
    } catch (err) {
      ctx.ui.notify(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
    return { action: "handled" };
  });
}
