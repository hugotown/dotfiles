/**
 * sync-opencode-models — Pi extension entry point.
 *
 * Refreshes opencode / opencode-go model lists in settings.json on quit.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { syncSettings } from "./lib/settings";
import { log } from "./lib/models";

export default function (pi: ExtensionAPI) {
  pi.on("session_shutdown", async (event) => {
    if (event.reason !== "quit") return;
    try {
      await syncSettings();
    } catch (err: any) {
      log("error", `sync failed: ${err?.message || err}`);
    }
  });
}
