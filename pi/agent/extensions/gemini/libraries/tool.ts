import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { buildSdkReport } from "./sdk";

/** LLM-callable surface: report the installed Gemini SDK and migration notes. */
export function registerLibrariesTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_sdk_info",
    label: "Gemini: SDK Info",
    description:
      "Report the installed @google/genai version, the deprecated package to migrate off, and install/upgrade commands for the Gemini JavaScript SDK.",
    parameters: Type.Object({}),
    async execute() {
      return { content: [{ type: "text" as const, text: buildSdkReport() }], details: {} };
    },
  });
}
