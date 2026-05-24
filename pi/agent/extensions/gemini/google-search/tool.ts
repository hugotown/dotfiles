import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TEXT_MODELS } from "../lib/models";
import { groundedSearch } from "./core";

/** LLM-callable surface for Google Search grounding. */
export function registerSearchTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_google_search",
    label: "Gemini: Google Search",
    description:
      "Answer a question grounded in real-time Google Search (current events, post-training facts). Returns the answer with inline [n](uri) citations and a sources list. Saves to gemini-output/grounded/.",
    parameters: Type.Object({
      query: Type.String({ description: "The question to answer with web grounding" }),
      model: Type.Optional(StringEnum(TEXT_MODELS, { default: TEXT_MODELS[0] })),
    }),
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const result = await groundedSearch(p.query, p.model ?? TEXT_MODELS[0], ctx.cwd);
      return {
        content: [{ type: "text" as const, text: `${result.cited}\n\n${result.sources}` }],
        details: { path: result.path },
      };
    },
  });
}
