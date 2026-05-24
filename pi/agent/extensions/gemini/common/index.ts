import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommonFlag } from "./flag";
import { registerCommonTool } from "./tool";

/** gemini-common (executable): setup/status tool + flag. */
export function registerCommon(pi: ExtensionAPI) {
  registerCommonTool(pi);
  registerCommonFlag(pi);
}
