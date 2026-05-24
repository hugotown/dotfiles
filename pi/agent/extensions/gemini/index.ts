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
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerTextRenderer } from "./lib/message";
import { registerImageGeneration } from "./image-generation";
import { registerImageUnderstanding } from "./image-understanding";
import { registerDocumentProcessing } from "./document-processing";
import { registerGoogleSearch } from "./google-search";
import { registerDeepResearch } from "./deep-research";
import { registerCommon } from "./common";
import { registerLibraries } from "./libraries";

export default function (pi: ExtensionAPI) {
  registerTextRenderer(pi);
  registerImageGeneration(pi);
  registerImageUnderstanding(pi);
  registerDocumentProcessing(pi);
  registerGoogleSearch(pi);
  registerDeepResearch(pi);
  registerCommon(pi);
  registerLibraries(pi);
}
