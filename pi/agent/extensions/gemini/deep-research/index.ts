import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerResearchFlag } from "./flag";
import { registerResearchTool } from "./tool";

/** gemini-deep-research: tool + flag (both run in the background). */
export function registerDeepResearch(pi: ExtensionAPI) {
  registerResearchTool(pi);
  registerResearchFlag(pi);
}
