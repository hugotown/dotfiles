import type {
  AssistantMessage, AssistantMessageEventStream,
  Context, Model, SimpleStreamOptions, TextContent, Api,
} from "@earendil-works/pi-ai";
import { calculateCost, createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { spawn } from "node:child_process";
import { flattenMessages } from "./flatten";
import { handleStreamEvent } from "./events";

function log(level: "info" | "error", message: string): void {
  console.error(`[claude-cli-pi] ${level.toUpperCase()} ${message}`);
}

export function streamClaudeCli(
  model: Model<Api>, context: Context, options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant", content: [], api: model.api,
      provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop", timestamp: Date.now(),
    };
    stream.push({ type: "start", partial: output });

    try {
      const prompt = flattenMessages(context);
      const systemPrompt = context.systemPrompt?.trim() || "";
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;

      const modelId = model.id.includes("/") ? (model.id.split("/").pop() as string) : model.id;
      log("info", `dispatch model=${modelId}`);

      const args = ["-p", prompt, "--dangerously-skip-permissions", "--model", modelId,
        "--verbose", "--output-format", "stream-json", "--include-partial-messages"];
      if (systemPrompt) args.push("--append-system-prompt", systemPrompt);

      const child = spawn("claude", args, {
        env, stdio: ["ignore", "pipe", "pipe"], signal: options?.signal,
      });

      let stderrBuf = "";
      child.stderr.on("data", (c: Buffer) => { stderrBuf += c.toString("utf8"); });

      const applyUsage = (usage: any): void => {
        if (!usage) return;
        output.usage.input = usage.input_tokens ?? output.usage.input;
        output.usage.output = usage.output_tokens ?? output.usage.output;
        output.usage.cacheRead = usage.cache_read_input_tokens ?? output.usage.cacheRead;
        output.usage.cacheWrite = usage.cache_creation_input_tokens ?? output.usage.cacheWrite;
        output.usage.totalTokens = output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
        calculateCost(model, output.usage);
      };

      const activeBlocks: Map<number, { type: "text" | "thinking"; contentIndex: number }> = new Map();

      const handleLine = (line: string): void => {
        if (!line.trim()) return;
        let parsed: any;
        try { parsed = JSON.parse(line); } catch { return; }
        if (parsed?.type === "stream_event") {
          handleStreamEvent(parsed.event, output, activeBlocks, stream, applyUsage);
          return;
        }
        if (parsed?.type === "assistant") return;
        if (parsed?.type === "result") {
          applyUsage(parsed.usage);
          if (typeof parsed.total_cost_usd === "number") output.usage.cost.total = parsed.total_cost_usd;
          if (typeof parsed.result === "string" && parsed.result && !output.content.some((c) => c.type === "text")) {
            const ci = output.content.length;
            output.content.push({ type: "text", text: parsed.result } as TextContent);
            stream.push({ type: "text_start", contentIndex: ci, partial: output });
            stream.push({ type: "text_delta", contentIndex: ci, delta: parsed.result, partial: output });
            stream.push({ type: "text_end", contentIndex: ci, content: parsed.result, partial: output });
          }
          if (parsed.stop_reason === "max_tokens") output.stopReason = "length";
          else if (parsed.is_error) output.stopReason = "error";
        }
      };

      let stdoutBuf = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString("utf8");
        let nl = stdoutBuf.indexOf("\n");
        while (nl !== -1) { handleLine(stdoutBuf.slice(0, nl)); stdoutBuf = stdoutBuf.slice(nl + 1); nl = stdoutBuf.indexOf("\n"); }
      });

      const exitCode: number | null = await new Promise((resolve, reject) => {
        child.on("error", reject); child.on("exit", (code) => resolve(code));
      });
      if (stdoutBuf.trim()) handleLine(stdoutBuf);
      if (options?.signal?.aborted) throw new Error("Request was aborted");
      if (exitCode !== 0 && output.stopReason === "stop") {
        throw new Error(`claude exited with code ${exitCode}: ${stderrBuf.slice(0, 500)}`);
      }

      stream.push({ type: "done", reason: output.stopReason as "stop" | "length" | "toolUse", message: output });
      stream.end();
    } catch (err: any) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = err instanceof Error ? err.message : String(err);
      log("error", `request failed: ${output.errorMessage}`);
      stream.push({ type: "error", reason: output.stopReason as "aborted" | "error", error: output });
      stream.end();
    }
  })();

  return stream;
}
