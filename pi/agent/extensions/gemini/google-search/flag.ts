import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { showForm, type FormField } from "../lib/form";
import { sendText } from "../lib/message";
import { TEXT_MODELS } from "../lib/models";
import { applyAliases, parseSubflags } from "../lib/parse";
import { groundedSearch } from "./core";

const FIELDS: FormField[] = [
  { id: "query", label: "Query", kind: "text" },
  { id: "model", label: "Model", kind: "enum", values: [...TEXT_MODELS] },
];

/** `--gemini-google-search [query] [--model …]` — grounded answer, no LLM. */
export function registerSearchFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-google-search",
    description: "Answer grounded in real-time Google Search with citations (subflags: --model)",
    handle: async (raw, ctx) => {
      const { positional, opts } = parseSubflags(raw);
      const query0 = positional || (await ctx.ui.input("Search query", "")) || "";
      if (!query0.trim()) { ctx.ui.notify("Cancelled: empty query.", "warning"); return; }

      const initial = applyAliases({ query: query0, model: TEXT_MODELS[0] }, opts, { model: "model" });
      const values = await showForm(ctx, "Gemini: Google Search", FIELDS, initial, "▶ Search");
      if (!values) { ctx.ui.notify("Cancelled.", "info"); return; }
      const query = values.query.trim();
      if (!query) { ctx.ui.notify("Query is empty.", "warning"); return; }

      ctx.ui.notify(`Searching with ${values.model} + Google…`, "info");
      const result = await groundedSearch(query, values.model, ctx.cwd);
      sendText(pi, `${result.cited}\n\n${result.sources}`, `Grounded · ${result.path}`);
    },
  });
}
