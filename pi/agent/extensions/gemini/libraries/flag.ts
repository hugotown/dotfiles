import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { buildSdkReport } from "./sdk";

/** `--gemini-libraries` — show installed SDK version + migration guidance. */
export function registerLibrariesFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-libraries",
    description: "Show installed Gemini SDK version and install/migration commands",
    handle: async (_prompt, _ctx) => {
      sendText(pi, buildSdkReport(), "Gemini SDK");
    },
  });
}
