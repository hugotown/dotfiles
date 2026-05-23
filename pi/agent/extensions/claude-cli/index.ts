/**
 * claude-cli — Pi extension entry point.
 *
 * Exposes the local `claude` CLI as an in-process model provider via
 * Pi's `streamSimple` hook. No HTTP, no proxy, no port.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROVIDER_NAME, PROVIDER_API, MODELS } from "./lib/constants";
import { streamClaudeCli } from "./lib/stream";

export default function (pi: ExtensionAPI) {
  pi.registerProvider(PROVIDER_NAME, {
    name: "Claude Local CLI Wrapper",
    baseUrl: "http://127.0.0.1",
    apiKey: "_claude_cli_local_dummy",
    api: PROVIDER_API,
    streamSimple: streamClaudeCli,
    models: MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200_000,
      maxTokens: 16_384,
    })),
  });
}
