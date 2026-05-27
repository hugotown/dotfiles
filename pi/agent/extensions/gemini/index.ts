/**
 * pi-tool-gemini — Gemini API suite.
 *
 * One package, seven sub-extensions. Each consolidates a `gemini-*` skill into
 * code and exposes BOTH surfaces:
 *   - a TOOL (LLM-callable, runs with prompt context)
 *   - a FLAG (`--gemini-<x>`, intercepted before the LLM, hybrid ask-vs-direct)
 *
 * Shared setup (client, API key, output conventions, model catalogs) lives in
 * lib/ — that is the consolidated `gemini-common`.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerTextRenderer } from "./lib/message";
import { registerImageGeneration } from "./image-generation";
import { registerImageUnderstanding } from "./image-understanding";
import { registerDocumentProcessing } from "./document-processing";
import { registerGoogleSearch } from "./google-search";
import { registerDeepResearch } from "./deep-research";
import { registerCommon } from "./common";
import { registerLibraries } from "./libraries";
import { installFlagPanelTrigger } from "./panel/trigger";

export default function (pi: ExtensionAPI) {
  registerTextRenderer(pi);
  registerImageGeneration(pi);
  registerImageUnderstanding(pi);
  registerDocumentProcessing(pi);
  registerGoogleSearch(pi);
  registerDeepResearch(pi);
  registerCommon(pi);
  registerLibraries(pi);

  // Open the pre-filled form panel when the user presses the trigger key (default TAB)
  // and the editor text ends with a `--gemini-*` flag. Install once, when a UI exists;
  // hook two early events so it is wired by the first prompt at latest (like subagent).
  let installed = false;
  const ensureTrigger = (ctx: ExtensionContext) => {
    if (installed || !ctx.hasUI) return;
    installed = true;
    installFlagPanelTrigger(ctx);
  };
  pi.on("session_start", (_event, ctx) => ensureTrigger(ctx));
  pi.on("before_agent_start", (_event, ctx) => ensureTrigger(ctx));
}
