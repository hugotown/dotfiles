import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { TEXT_MODELS } from "genai-core/models";
import { analyzeImage } from "genai-core/image-understanding/core";
import type { AnalyzeInput } from "genai-core/image-understanding/core";

const AnalyzeSchema = Type.Object({
  image: Type.String({ description: "Local file path or http(s) URL of the image" }),
  prompt: Type.String({ description: "What to do: 'caption', 'transcribe all text', 'detect objects', etc." }),
  model: Type.Optional(StringEnum(TEXT_MODELS, { default: TEXT_MODELS[0] })),
  json: Type.Optional(Type.Boolean({ description: "Return structured JSON (detection/extraction). Use gemini-2.5-pro for hard cases.", default: false })),
  schema: Type.Optional(Type.String({ description: "Raw JSON Schema string constraining the JSON output (only used when json=true)." })),
  systemInstruction: Type.Optional(Type.String({ description: "System instruction steering tone/role/format." })),
  thinkingBudget: Type.Optional(Type.Integer({ description: "Reasoning budget in tokens (0 = off, -1 = automatic). Gemini 2.5 models." })),
});

type _AnalyzeSchemaShape = Static<typeof AnalyzeSchema>;
type _AnalyzeAssert = _AnalyzeSchemaShape extends Partial<AnalyzeInput> ? true : never;
const _analyzeCheck: _AnalyzeAssert = true; void _analyzeCheck;

/** LLM-callable surface for image understanding. */
export function registerUnderstandingTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_analyze_image",
    label: "Gemini: Analyze Image",
    description:
      "Analyze an image with Gemini vision: caption, OCR, classify, detect objects (boxes as [ymin,xmin,ymax,xmax] in 0-1000), or answer a visual question. Saves output to gemini-output/vision/.",
    parameters: AnalyzeSchema,
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const result = await analyzeImage(
        {
          image: p.image, prompt: p.prompt, model: p.model ?? TEXT_MODELS[0], json: p.json ?? false,
          schema: p.schema, systemInstruction: p.systemInstruction, thinkingBudget: p.thinkingBudget,
        },
        ctx.cwd,
      );
      return {
        content: [{ type: "text" as const, text: result.text }],
        details: { path: result.path },
      };
    },
  });
}
