import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerUnderstandingFlag } from "./flag";
import { registerUnderstandingTool } from "./tool";

/** gemini-image-understanding: tool + flag. */
export function registerImageUnderstanding(pi: ExtensionAPI) {
  registerUnderstandingTool(pi);
  registerUnderstandingFlag(pi);
}
