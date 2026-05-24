import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerImageFlag } from "./flag";
import { registerImageRenderer } from "./renderer";
import { registerImageTool } from "./tool";

/** gemini-image-generation: tool + flag + inline-image renderer. */
export function registerImageGeneration(pi: ExtensionAPI) {
  registerImageRenderer(pi);
  registerImageTool(pi);
  registerImageFlag(pi);
}
