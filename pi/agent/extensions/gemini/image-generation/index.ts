import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerImageFlag } from "./flag";
import { registerImageTool } from "./tool";

/** gemini-image-generation: tool + flag (image opens externally; no inline renderer). */
export function registerImageGeneration(pi: ExtensionAPI) {
  registerImageTool(pi);
  registerImageFlag(pi);
}
