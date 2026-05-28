import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDeepResearchTools } from "./tool";

/** gemini-deep-research: async start + poll pattern. */
export function registerDeepResearch(pi: ExtensionAPI) {
  registerDeepResearchTools(pi);
}
