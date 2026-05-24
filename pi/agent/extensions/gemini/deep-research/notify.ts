import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { sendText } from "../lib/message";
import { pollResearch } from "./research";

/**
 * Fire-and-forget poll. Posts the finished report (or terminal status) to the
 * conversation when the agent completes — the session stays usable meanwhile.
 */
export function launchPoll(pi: ExtensionAPI, id: string, query: string, cwd: string): void {
  pollResearch(id, query, cwd)
    .then((done) => {
      if (done.status === "completed" && done.path) {
        sendText(pi, done.text, `Deep Research complete · ${done.path}`);
      } else {
        sendText(pi, `Interaction ${id} ended with status: ${done.status}.`, "Deep Research");
      }
    })
    .catch((err) => sendText(pi, err instanceof Error ? err.message : String(err), "Deep Research failed"));
}
