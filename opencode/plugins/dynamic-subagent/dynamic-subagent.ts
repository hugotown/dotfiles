import type { Plugin } from "@opencode-ai/plugin";
import { createDynamicSubagentTool } from "./dynamic-subagent-tool";

export const DynamicSubagentPlugin: Plugin = async ({ client }) => ({
  tool: {
    dynamicSubagent: createDynamicSubagentTool(client),
  },
});
