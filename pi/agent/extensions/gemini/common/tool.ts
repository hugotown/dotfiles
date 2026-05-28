import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { buildStatus } from "genai-core/common/status";

const EmptySchema = Type.Object({});
type _CommonSchemaShape = Static<typeof EmptySchema>;
type _CommonAssert = _CommonSchemaShape extends object ? true : never;
const _commonCheck: _CommonAssert = true; void _commonCheck;

/** LLM-callable surface: report Gemini setup/connectivity status. */
export function registerCommonTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_status",
    label: "Gemini: Status",
    description:
      "Check Gemini setup: API key presence, API connectivity, available models/agents, and output-folder conventions. Use to diagnose why another Gemini tool failed.",
    parameters: EmptySchema,
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
