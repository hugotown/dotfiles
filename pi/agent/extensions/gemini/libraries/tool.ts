import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { buildSdkReport } from "genai-core/libraries/sdk";

const EmptySchema = Type.Object({});
type _LibSchemaShape = Static<typeof EmptySchema>;
type _LibAssert = _LibSchemaShape extends object ? true : never;
const _libCheck: _LibAssert = true; void _libCheck;

/** LLM-callable surface: report the installed Gemini SDK and migration notes. */
export function registerLibrariesTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_libraries",
    label: "Gemini: SDK Info",
    description:
      "Report the installed @google/genai version, the deprecated package to migrate off, and install/upgrade commands for the Gemini JavaScript SDK.",
    parameters: EmptySchema,
    async execute() {
      return { content: [{ type: "text" as const, text: buildSdkReport() }], details: {} };
    },
  });
}
