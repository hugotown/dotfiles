import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { RESEARCH_AGENTS } from "genai-core/models";
import { startResearch, pollResearch } from "genai-core/deep-research/research";

interface Job { done: boolean; report?: string; error?: string; startedAt: number; query: string; cwd: string; }
const jobs = new Map<string, Job>();

export function registerDeepResearchTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_deep_research_start",
    label: "Gemini: Deep Research — Start",
    description:
      "Start a multi-step agentic Deep Research task. Returns a jobId immediately; poll with gemini_deep_research_poll to get the report (~20–60 min).",
    parameters: Type.Object({
      query: Type.String({ description: "Research question or topic" }),
      agent: Type.Optional(StringEnum(RESEARCH_AGENTS, { default: RESEARCH_AGENTS[0] })),
    }),
    async execute(_id, p, _signal, _onUpdate, ctx) {
      const agent = p.agent ?? RESEARCH_AGENTS[0];
      const interactionId = await startResearch(p.query, agent);
      const job: Job = { done: false, startedAt: Date.now(), query: p.query, cwd: ctx.cwd };
      jobs.set(interactionId, job);
      pollResearch(interactionId, p.query, ctx.cwd)
        .then((done) => { job.done = true; job.report = done.text; })
        .catch((err) => { job.done = true; job.error = String(err); });
      return {
        content: [{ type: "text" as const, text: `Deep Research started (jobId: ${interactionId}, agent: ${agent}). Poll with gemini_deep_research_poll.` }],
        jobId: interactionId,
      };
    },
  });

  pi.registerTool({
    name: "gemini_deep_research_poll",
    label: "Gemini: Deep Research — Poll",
    description: "Poll the status of a deep research job started with gemini_deep_research_start.",
    parameters: Type.Object({
      jobId: Type.String({ description: "Job ID returned by gemini_deep_research_start" }),
    }),
    async execute(_id, p) {
      const job = jobs.get(p.jobId);
      if (!job) return { content: [{ type: "text" as const, text: `Unknown jobId: ${p.jobId}` }], status: "not_found" };
      if (!job.done) {
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        return { content: [{ type: "text" as const, text: `Research in progress (${elapsed}s elapsed). Poll again in a few seconds.` }], status: "running", elapsed };
      }
      if (job.error) return { content: [{ type: "text" as const, text: `Research failed: ${job.error}` }], status: "error", error: job.error };
      return { content: [{ type: "text" as const, text: job.report ?? "" }], status: "done" };
    },
  });
}
