import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDocumentFlag } from "./flag";
import { registerDocumentTool } from "./tool";

/** gemini-document-processing: tool + flag. */
export function registerDocumentProcessing(pi: ExtensionAPI) {
  registerDocumentTool(pi);
  registerDocumentFlag(pi);
}
