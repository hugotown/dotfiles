import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { buildStatus } from "./status";

/** `--gemini-common` — verify Gemini setup and connectivity. */
export function registerCommonFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-common",
    description: "Check Gemini setup: API key, connectivity, models, conventions",
    handle: async (_prompt, ctx) => {
      ctx.ui.notify("Checking Gemini setup…", "info");
      const report = await buildStatus();
      sendText(pi, report.text, report.ok ? "Gemini setup OK" : "Gemini setup issue");
    },
  });
}
