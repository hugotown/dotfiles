import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFlag } from "../lib/flag";
import { showForm, type FormField } from "../lib/form";
import { RESEARCH_AGENTS } from "../lib/models";
import { applyAliases, parseSubflags } from "../lib/parse";
import { launchPoll } from "./notify";
import { startResearch } from "./research";

const FIELDS: FormField[] = [
  { id: "query", label: "Research question", kind: "text" },
  { id: "agent", label: "Agent", kind: "enum", values: [...RESEARCH_AGENTS] },
];

/** `--gemini-deep-research [question] [--agent …]` — starts background research. */
export function registerResearchFlag(pi: ExtensionAPI) {
  registerFlag(pi, {
    token: "gemini-deep-research",
    description: "Start agentic multi-step Deep Research in the background (subflags: --agent)",
    handle: async (raw, ctx) => {
      const { positional, opts } = parseSubflags(raw);
      const query0 = positional || (await ctx.ui.input("Research question", "")) || "";
      if (!query0.trim()) { ctx.ui.notify("Cancelled: empty question.", "warning"); return; }

      const initial = applyAliases({ query: query0, agent: RESEARCH_AGENTS[0] }, opts, { agent: "agent" });
      const values = await showForm(ctx, "Gemini: Deep Research", FIELDS, initial, "▶ Start research");
      if (!values) { ctx.ui.notify("Cancelled.", "info"); return; }
      const query = values.query.trim();
      if (!query) { ctx.ui.notify("Question is empty.", "warning"); return; }

      const id = await startResearch(query, values.agent);
      ctx.ui.notify(`Deep Research started (id: ${id}, agent: ${values.agent}). Keep working — I'll post the report when ready.`, "info");
      launchPoll(pi, id, query, ctx.cwd);
    },
  });
}
