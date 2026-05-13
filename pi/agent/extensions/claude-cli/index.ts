/**
 * claude-cli — Pi extension that exposes the local `claude` CLI as an in-process
 * model provider via Pi's `streamSimple` hook. No HTTP, no proxy, no port.
 *
 * Architecture:
 *   Pi  ──function call──>  streamClaudeCli()  ──spawn──>  claude -p ... stream-json
 *
 * Why no HTTP: Pi and this extension share a Node process. A loopback HTTP
 * hop only existed because the old impl declared `api: "openai-completions"`,
 * which forces an HTTP transport. `streamSimple` lets us implement the
 * provider directly in-process, which also unlocks real per-block streaming
 * instead of the simulated chunking the old proxy did.
 *
 * Intentional limitations:
 *   - --dangerously-skip-permissions stays on (user-confirmed). The subprocess
 *     can run bash/edit/write inside cwd without confirmation.
 *   - Pi's tool definitions are NOT forwarded to the CLI. The CLI runs its
 *     own internal tools; surfacing them as Pi `toolCall` events would break
 *     Pi's contract (it expects toolResults to round-trip through the model).
 *   - Image content in user messages is replaced with "[Image Omitted]"
 *     because `claude -p` takes a single string prompt.
 */

import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
  TextContent,
} from "@earendil-works/pi-ai";
import {
  calculateCost,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";

const PROVIDER_NAME = "claude-local-cli";
const PROVIDER_API: Api = "claude-local-cli";

const MODELS = [
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7 (via Subprocess)",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (via Subprocess)",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5 (via Subprocess)",
  },
];

function flattenContext(context: Context): string {
  const parts: string[] = [];

  if (context.systemPrompt?.trim()) {
    parts.push(`System:\n${context.systemPrompt.trim()}`);
  }

  for (const msg of context.messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .map((c) => (c.type === "text" ? c.text : "[Image Omitted]"))
              .join("\n");
      parts.push(`USER:\n${text}`);
    } else if (msg.role === "assistant") {
      const text = msg.content
        .map((c) => {
          if (c.type === "text") return c.text;
          if (c.type === "thinking") return `[thinking] ${c.thinking}`;
          if (c.type === "toolCall")
            return `[tool ${c.name}] ${JSON.stringify(c.arguments)}`;
          return "";
        })
        .filter(Boolean)
        .join("\n");
      parts.push(`ASSISTANT:\n${text}`);
    } else if (msg.role === "toolResult") {
      const text = msg.content
        .map((c) => (c.type === "text" ? c.text : "[Image Omitted]"))
        .join("\n");
      parts.push(
        `TOOL_RESULT (${msg.toolName}${msg.isError ? ", error" : ""}):\n${text}`,
      );
    }
  }

  return parts.join("\n\n");
}

function log(level: "info" | "error", message: string): void {
  console.error(`[claude-cli-pi] ${level.toUpperCase()} ${message}`);
}

function streamClaudeCli(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    stream.push({ type: "start", partial: output });

    try {
      const prompt = flattenContext(context);

      // Strip Anthropic API keys so the CLI uses its own login / OAuth token.
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;

      // `model.id` arrives as the bare id (e.g. "claude-opus-4-7"); guard
      // against future Pi versions that might prefix it with the provider.
      const modelId = model.id.includes("/")
        ? (model.id.split("/").pop() as string)
        : model.id;

      log("info", `dispatch model=${modelId}`);

      const child = spawn(
        "claude",
        [
          "-p",
          `<general-instructions>
            - do not use any tool unless user explicitly tells you to use them
            - do not use any skill unless user explicitly tells you to use them
            - if you have questions ask in plain text
              <user-request>
                ${prompt}
              </user-request>
            - if there any quirks, gotchas, recommendations, improvements, pendings, please place it all in your response as <quirks>,<gotchas>,etc.
          </general-instructions>`,
          "--dangerously-skip-permissions",
          "--model",
          modelId,
          "--verbose",
          "--output-format",
          "stream-json",
        ],
        {
          env,
          stdio: ["ignore", "pipe", "pipe"],
          signal: options?.signal,
        },
      );

      let stderrBuf = "";
      child.stderr.on("data", (c: Buffer) => {
        stderrBuf += c.toString("utf8");
      });

      const applyUsage = (usage: any): void => {
        if (!usage) return;
        output.usage.input = usage.input_tokens ?? output.usage.input;
        output.usage.output = usage.output_tokens ?? output.usage.output;
        output.usage.cacheRead =
          usage.cache_read_input_tokens ?? output.usage.cacheRead;
        output.usage.cacheWrite =
          usage.cache_creation_input_tokens ?? output.usage.cacheWrite;
        output.usage.totalTokens =
          output.usage.input +
          output.usage.output +
          output.usage.cacheRead +
          output.usage.cacheWrite;
        calculateCost(model, output.usage);
      };

      const emitTextBlock = (text: string): void => {
        const contentIndex = output.content.length;
        const block: TextContent = { type: "text", text };
        output.content.push(block);
        stream.push({ type: "text_start", contentIndex, partial: output });
        if (text) {
          stream.push({
            type: "text_delta",
            contentIndex,
            delta: text,
            partial: output,
          });
        }
        stream.push({
          type: "text_end",
          contentIndex,
          content: text,
          partial: output,
        });
      };

      const emitThinkingBlock = (text: string, signature?: string): void => {
        const contentIndex = output.content.length;
        output.content.push({
          type: "thinking",
          thinking: text,
          thinkingSignature: signature ?? "",
        });
        stream.push({
          type: "thinking_start",
          contentIndex,
          partial: output,
        });
        if (text) {
          stream.push({
            type: "thinking_delta",
            contentIndex,
            delta: text,
            partial: output,
          });
        }
        stream.push({
          type: "thinking_end",
          contentIndex,
          content: text,
          partial: output,
        });
      };

      const handleLine = (line: string): void => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event?.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              emitTextBlock(block.text);
            } else if (
              block.type === "thinking" &&
              typeof block.thinking === "string"
            ) {
              emitThinkingBlock(block.thinking, block.signature);
            }
            // tool_use blocks are intentionally dropped — see file header.
          }
          applyUsage(event.message.usage);
        } else if (event?.type === "result") {
          applyUsage(event.usage);
          if (typeof event.total_cost_usd === "number") {
            output.usage.cost.total = event.total_cost_usd;
          }
          // Fallback: if the CLI ran without emitting any text block (rare,
          // but possible if everything was tool_use), surface `result` so
          // Pi has something to display.
          if (
            typeof event.result === "string" &&
            event.result &&
            !output.content.some((c) => c.type === "text")
          ) {
            emitTextBlock(event.result);
          }
          if (event.stop_reason === "max_tokens") output.stopReason = "length";
          else if (event.is_error) output.stopReason = "error";
        }
      };

      let stdoutBuf = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString("utf8");
        let nl = stdoutBuf.indexOf("\n");
        while (nl !== -1) {
          handleLine(stdoutBuf.slice(0, nl));
          stdoutBuf = stdoutBuf.slice(nl + 1);
          nl = stdoutBuf.indexOf("\n");
        }
      });

      const exitCode: number | null = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (code) => resolve(code));
      });

      if (stdoutBuf.trim()) handleLine(stdoutBuf);

      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }

      if (exitCode !== 0 && output.stopReason === "stop") {
        throw new Error(
          `claude exited with code ${exitCode}: ${stderrBuf.slice(0, 500)}`,
        );
      }

      stream.push({
        type: "done",
        reason: output.stopReason as "stop" | "length" | "toolUse",
        message: output,
      });
      stream.end();
    } catch (err: any) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = err instanceof Error ? err.message : String(err);
      log("error", `request failed: ${output.errorMessage}`);
      stream.push({
        type: "error",
        reason: output.stopReason as "aborted" | "error",
        error: output,
      });
      stream.end();
    }
  })();

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(PROVIDER_NAME, {
    name: "Claude Local CLI Wrapper",
    // `baseUrl` is required by Pi's validator when `models` is provided, even
    // though `streamSimple` short-circuits all HTTP. This placeholder is
    // never dialled.
    baseUrl: "http://127.0.0.1",
    apiKey: "_claude_cli_local_dummy",
    api: PROVIDER_API,
    streamSimple: streamClaudeCli,
    models: MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200_000,
      maxTokens: 16_384,
    })),
  });
}
