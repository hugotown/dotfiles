import type { Plugin } from "@opencode-ai/plugin";
import { imageGenerationTool, imageUnderstandingTool } from "../gemini/tools-image";
import { documentProcessingTool, googleSearchTool } from "../gemini/tools-docs";
import { deepResearchStartTool, deepResearchPollTool } from "../gemini/tools-research";
import { statusTool, librariesTool } from "../gemini/tools-meta";

export const server: Plugin = async () => ({
  tool: {
    gemini_generate_image: imageGenerationTool,
    gemini_analyze_image: imageUnderstandingTool,
    gemini_process_document: documentProcessingTool,
    gemini_google_search: googleSearchTool,
    gemini_deep_research_start: deepResearchStartTool,
    gemini_deep_research_poll: deepResearchPollTool,
    gemini_status: statusTool,
    gemini_libraries: librariesTool,
  },
});
