import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSearchFlag } from "./flag";
import { registerSearchTool } from "./tool";

/** gemini-google-search: tool + flag. */
export function registerGoogleSearch(pi: ExtensionAPI) {
  registerSearchTool(pi);
  registerSearchFlag(pi);
}
