import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { RESEARCH_AGENTS } from "../lib/models";
import { launchPoll } from "./notify";
import { startResearch } from "./research";

/** `--gemini-deep-research [question]` — starts background research, returns immediately. */
export function registerResearchFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-deep-research",
    description: "Start agentic multi-step Deep Research (background, posts report when ready)",
    handle: async (prompt, ctx) => {
      const query = prompt || (await ctx.ui.input("Research question", "")) || "";
      if (!query.trim()) { ctx.ui.notify("Cancelled: empty question.", "warning"); return; }

      const id = await startResearch(query, RESEARCH_AGENTS[0]);
      ctx.ui.notify(`Deep Research started (id: ${id}). Keep working — I'll post the report when ready.`, "info");
      launchPoll(pi, id, query, ctx.cwd);
    },
  });
}
