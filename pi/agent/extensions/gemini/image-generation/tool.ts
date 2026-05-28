import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { ASPECT_RATIOS, IMAGE_MODELS, IMAGE_SIZES } from "genai-core/models";
import { generateImage } from "genai-core/image-generation/core";
import { openExternally } from "../lib/open";
import type { ImageForm } from "genai-core/image-generation/types";

const ImageSchema = Type.Object({
  prompt: Type.String({ description: "What to generate" }),
  model: Type.Optional(StringEnum(IMAGE_MODELS, { default: IMAGE_MODELS[0] })),
  aspectRatio: Type.Optional(StringEnum(ASPECT_RATIOS, { default: "16:9" })),
  imageSize: Type.Optional(StringEnum(IMAGE_SIZES, { default: "1K" })),
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2, default: 1 })),
  seed: Type.Optional(Type.Integer({ description: "Fixed seed for reproducibility" })),
});

type _ImageSchemaShape = Static<typeof ImageSchema>;
type _ImageAssert = _ImageSchemaShape extends Partial<ImageForm> ? true : never;
const _imageCheck: _ImageAssert = true; void _imageCheck;

/** LLM-callable surface for image generation. Same core as the flag. */
export function registerImageTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_generate_image",
    label: "Gemini: Generate Image",
    description:
      "Generate an image from a text prompt with Gemini. Saves to gemini-output/images/ and returns the file path.",
    parameters: ImageSchema,
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const details = await generateImage({
        prompt: p.prompt,
        model: p.model ?? IMAGE_MODELS[0],
        aspectRatio: p.aspectRatio ?? "16:9",
        imageSize: p.imageSize ?? "1K",
        temperature: p.temperature ?? 1,
        seed: p.seed ?? null,
      }, ctx.cwd);
      openExternally(details.path);
      return {
        content: [{ type: "text" as const, text: `Generated image saved to ${details.path}` }],
        details,
      };
    },
  });
}
