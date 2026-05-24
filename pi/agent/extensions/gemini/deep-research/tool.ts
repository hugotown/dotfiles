import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { RESEARCH_AGENTS } from "../lib/models";
import { launchPoll } from "./notify";
import { startResearch } from "./research";

/** LLM-callable surface. Starts research in the background and returns the id. */
export function registerResearchTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_deep_research",
    label: "Gemini: Deep Research",
    description:
      "Start a multi-step, agentic Deep Research task (analyst-grade report with citations). Runs in the BACKGROUND (~20 min, up to 60) — this returns immediately with an interaction id; the finished report is posted to the conversation and saved to gemini-output/research/.",
    parameters: Type.Object({
      query: Type.String({ description: "The research question or topic" }),
      agent: Type.Optional(StringEnum(RESEARCH_AGENTS, { default: RESEARCH_AGENTS[0] })),
    }),
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const agent = p.agent ?? RESEARCH_AGENTS[0];
      const id = await startResearch(p.query, agent);
      launchPoll(pi, id, p.query, ctx.cwd);
      return {
        content: [{
          type: "text" as const,
          text: `Deep Research started in background (id: ${id}, agent: ${agent}). The report will be posted when ready.`,
        }],
        details: { id, agent },
      };
    },
  });
}
