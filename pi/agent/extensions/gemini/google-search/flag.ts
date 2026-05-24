import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "../lib/models";
import { groundedSearch } from "./core";

/** `--gemini-google-search [query]` — hybrid ask-vs-direct. */
export function registerSearchFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-google-search",
    description: "Answer grounded in real-time Google Search with citations",
    handle: async (prompt, ctx) => {
      const query = prompt || (await ctx.ui.input("Search query", "")) || "";
      if (!query.trim()) { ctx.ui.notify("Cancelled: empty query.", "warning"); return; }

      ctx.ui.notify("Searching with Gemini + Google…", "info");
      const result = await groundedSearch(query, TEXT_MODELS[0], ctx.cwd);
      sendText(pi, `${result.cited}\n\n${result.sources}`, `Grounded · ${result.path}`);
    },
  });
}
