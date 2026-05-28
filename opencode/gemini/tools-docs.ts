import { tool } from "@opencode-ai/plugin";
import { processDocument } from "genai-core/document-processing/core";
import { groundedSearch } from "genai-core/google-search/core";
import { TEXT_MODELS } from "genai-core/models";

export const documentProcessingTool = tool({
  description: "Process a PDF/document with Gemini (summarize, extract, classify, etc.).",
  args: {
    file: tool.schema.string().describe("Local path to .pdf/.txt/.md/.html/.xml file"),
    prompt: tool.schema.string().describe("Instruction, e.g. 'summarize in 5 bullets'"),
    model: tool.schema.string().optional().describe(`Model. Default: ${TEXT_MODELS[0]}`),
    json: tool.schema.boolean().optional().describe("Return structured JSON"),
    schema: tool.schema.string().optional().describe("JSON Schema (when json=true)"),
    systemInstruction: tool.schema.string().optional().describe("System instruction"),
    thinkingBudget: tool.schema.number().optional().describe("Thinking budget tokens"),
  },
  async execute(args, ctx) {
    const result = await processDocument({
      file: args.file,
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

export const googleSearchTool = tool({
  description: "Real-time grounded web answer with citations via Gemini + Google Search.",
  args: {
    query: tool.schema.string().describe("Question to answer with web grounding"),
    model: tool.schema.string().optional().describe(`Model. Default: ${TEXT_MODELS[0]}`),
  },
  async execute(args, ctx) {
    const result = await groundedSearch(args.query, args.model ?? TEXT_MODELS[0], ctx.directory);
    return { output: `${result.cited}\n\n${result.sources}`, metadata: { path: result.path } };
  },
});
