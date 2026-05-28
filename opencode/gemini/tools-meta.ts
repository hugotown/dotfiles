import { tool } from "@opencode-ai/plugin";
import { buildStatus } from "genai-core/common/status";
import { buildSdkReport } from "genai-core/libraries/sdk";

export const statusTool = tool({
  description: "Check Gemini API connectivity and list available models.",
  args: {},
  async execute() {
    const { text } = await buildStatus();
    return text;
  },
});

export const librariesTool = tool({
  description: "Report the installed @google/genai SDK version and migration guidance.",
  args: {},
  async execute() {
    return buildSdkReport();
  },
});
