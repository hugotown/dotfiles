import { tool } from "@opencode-ai/plugin";
import { generateImage } from "genai-core/image-generation/core";
import { IMAGE_MODELS, ASPECT_RATIOS, IMAGE_SIZES, TEXT_MODELS } from "genai-core/models";
import { analyzeImage } from "genai-core/image-understanding/core";
import { spawn } from "node:child_process";

function openFile(path: string) {
  if (process.platform === "darwin") spawn("open", [path], { detached: true, stdio: "ignore" }).unref();
}

export const imageGenerationTool = tool({
  description: "Generate an image with Gemini Imagen. Returns the local file path.",
  args: {
    prompt: tool.schema.string().describe("What to generate"),
    model: tool.schema.string().optional().describe(`Model. Default: ${IMAGE_MODELS[0]}`),
    aspectRatio: tool.schema.string().optional().describe("Aspect ratio, e.g. 16:9"),
    imageSize: tool.schema.string().optional().describe("Resolution: 1K, 2K, 4K"),
    temperature: tool.schema.number().optional().describe("Creativity (0-2)"),
    seed: tool.schema.number().optional().describe("Fixed seed for reproducibility"),
  },
  async execute(args, ctx) {
    const details = await generateImage({
      prompt: args.prompt,
      model: args.model ?? IMAGE_MODELS[0],
      aspectRatio: (args.aspectRatio as typeof ASPECT_RATIOS[number]) ?? "16:9",
      imageSize: (args.imageSize as typeof IMAGE_SIZES[number]) ?? "1K",
      temperature: args.temperature ?? 1,
      seed: args.seed ?? null,
    }, ctx.directory);
    openFile(details.path);
    return { output: `Image saved to ${details.path}`, metadata: { path: details.path } };
  },
});

export const imageUnderstandingTool = tool({
  description: "Analyze an image with Gemini vision (caption, OCR, object detection, etc.).",
  args: {
    image: tool.schema.string().describe("Local file path or http(s) URL"),
    prompt: tool.schema.string().describe("What to do: caption, transcribe text, detect objects, etc."),
    model: tool.schema.string().optional().describe(`Model. Default: ${TEXT_MODELS[0]}`),
    json: tool.schema.boolean().optional().describe("Return structured JSON"),
    schema: tool.schema.string().optional().describe("JSON Schema string (only when json=true)"),
    systemInstruction: tool.schema.string().optional().describe("System instruction"),
    thinkingBudget: tool.schema.number().optional().describe("Thinking budget tokens"),
  },
  async execute(args, ctx) {
    const result = await analyzeImage({
      image: args.image,
      prompt: args.prompt,
      model: args.model ?? TEXT_MODELS[0],
      json: args.json ?? false,
      schema: args.schema,
      systemInstruction: args.systemInstruction,
      thinkingBudget: args.thinkingBudget,
    }, ctx.directory);
    return { output: result.text, metadata: { path: result.path } };
  },
});
