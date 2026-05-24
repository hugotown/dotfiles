import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerLibrariesFlag } from "./flag";
import { registerLibrariesTool } from "./tool";

/** gemini-libraries (executable): SDK info tool + flag. */
export function registerLibraries(pi: ExtensionAPI) {
  registerLibrariesTool(pi);
  registerLibrariesFlag(pi);
}
