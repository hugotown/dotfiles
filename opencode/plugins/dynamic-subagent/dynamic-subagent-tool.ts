import { tool } from "@opencode-ai/plugin";
import { formatSubagentResponse } from "./format-response";
import { parseModel } from "./parse-model";
import type { SubagentClient } from "./types";

const description = [
  "Launch a subagent with a dynamically chosen model, unlike the built-in task tool",
  "which always uses the agent's configured model. Runs the given agent in a child",
  "session of the current one and returns its final message. Use it when the user",
  "asks for a specific model per step, e.g. an explorer on a cheap/fast model and",
  "an implementer on a stronger model.",
  "Before every invocation, run `opencode models` through the Bash tool to discover",
  "the configured providers and model IDs, then use a `provider/model` returned by it.",
].join(" ");

export function createDynamicSubagentTool(client: SubagentClient) {
  return tool({
    description,
    args: {
      agent: tool.schema.string().describe("Agent to run, e.g. 'general', 'explore', or 'build'"),
      model: tool.schema.string().describe("Model as 'provider/model'"),
      prompt: tool.schema.string().describe("The task for the subagent to perform"),
      description: tool.schema.string().optional().describe("A short (3-5 words) task description"),
    },
    async execute(args, ctx) {
      const model = parseModel(args.model);
      const title = `${args.description ?? args.prompt.slice(0, 60)} (@${args.agent} · ${args.model})`;
      const created = await client.session.create({
        body: { parentID: ctx.sessionID, title },
        query: { directory: ctx.directory },
      });

      if (created.error || !created.data) {
        throw new Error(`Failed to create child session: ${JSON.stringify(created.error ?? "no data")}`);
      }

      const result = await client.session.prompt({
        path: { id: created.data.id },
        body: { agent: args.agent, model, parts: [{ type: "text", text: args.prompt }] },
      });

      if (result.error || !result.data) {
        throw new Error(`Subagent prompt failed: ${JSON.stringify(result.error ?? "no data")}`);
      }

      return {
        title,
        output: formatSubagentResponse(args.agent, result.data),
        metadata: { sessionId: created.data.id, model: args.model },
      };
    },
  });
}
