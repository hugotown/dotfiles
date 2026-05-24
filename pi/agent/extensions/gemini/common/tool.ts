import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { buildStatus } from "./status";

/** LLM-callable surface: report Gemini setup/connectivity status. */
export function registerCommonTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_status",
    label: "Gemini: Status",
    description:
      "Check Gemini setup: API key presence, API connectivity, available models/agents, and output-folder conventions. Use to diagnose why another Gemini tool failed.",
    parameters: Type.Object({}),
    async execute() {
      const report = await buildStatus();
      return {
        content: [{ type: "text" as const, text: report.text }],
        details: { ok: report.ok },
        isError: !report.ok,
      };
    },
  });
}
