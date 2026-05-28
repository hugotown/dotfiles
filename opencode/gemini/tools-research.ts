import { tool } from "@opencode-ai/plugin";
import { startResearch, pollResearch } from "genai-core/deep-research/research";
import { RESEARCH_AGENTS } from "genai-core/models";

interface Job { query: string; cwd: string; done: boolean; report?: string; error?: string; startedAt: number; }
const jobs = new Map<string, Job>();

export const deepResearchStartTool = tool({
  description: "Start an async deep-research job. Returns a jobId immediately; use gemini_deep_research_poll to check status.",
  args: {
    query: tool.schema.string().describe("Research question or topic"),
    agent: tool.schema.string().optional().describe(`Research agent. Default: ${RESEARCH_AGENTS[0]}`),
  },
  async execute(args, ctx) {
    const jobId = await startResearch(args.query, args.agent ?? RESEARCH_AGENTS[0]);
    const job: Job = { query: args.query, cwd: ctx.directory, done: false, startedAt: Date.now() };
    jobs.set(jobId, job);
    pollResearch(jobId, args.query, ctx.directory)
      .then((r) => { job.done = true; job.report = r.text; })
      .catch((err) => { job.done = true; job.error = String(err); });
    return { output: `Research started. Poll with jobId: ${jobId}`, metadata: { jobId } };
  },
});

export const deepResearchPollTool = tool({
  description: "Poll the status of a deep-research job started with gemini_deep_research_start.",
  args: {
    jobId: tool.schema.string().describe("Job ID returned by gemini_deep_research_start"),
  },
  async execute(args) {
    const job = jobs.get(args.jobId);
    if (!job) return { output: `Unknown jobId: ${args.jobId}` };
    if (!job.done) {
      const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
      return { output: `Research in progress (${elapsed}s). Poll again in a few seconds.` };
    }
    if (job.error) return { output: `Research failed: ${job.error}` };
    return { output: job.report ?? "", metadata: { done: true } };
  },
});
