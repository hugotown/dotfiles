import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const DEFAULT_PROVIDER_ID = "claude-cli";

const STOP_REASON_MAP = {
  end_turn: "stop",
  stop_sequence: "stop",
  stop: "stop",
  max_tokens: "length",
  length: "length",
  tool_use: "tool-calls",
  refusal: "content-filter",
  content_filter: "content-filter",
};

function emptyUsage() {
  return {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
  };
}

function mapFinishReason(rawReason) {
  return {
    unified: STOP_REASON_MAP[rawReason] ?? (rawReason ? "other" : "stop"),
    raw: rawReason,
  };
}

function flattenContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((p) => {
      if (typeof p === "string") return p;
      if (!p || typeof p !== "object") return "";
      if (p.type === "text") return p.text ?? "";
      if (p.type === "image" || p.type === "file") return "[binary content omitted]";
      if (p.type === "tool-call") {
        const args = p.input ?? p.args ?? {};
        return `[tool-call ${p.toolName ?? ""}(${JSON.stringify(args)})]`;
      }
      if (p.type === "tool-result") {
        const out = p.output ?? p.result;
        const rendered = typeof out === "string" ? out : JSON.stringify(out);
        return `[tool-result ${p.toolName ?? ""}: ${rendered}]`;
      }
      return "";
    })
    .join("");
}

function mapPromptToText(prompt) {
  const systemParts = [];
  const turns = [];
  for (const msg of prompt) {
    const text = flattenContent(msg.content);
    if (!text) continue;
    if (msg.role === "system") {
      systemParts.push(text);
    } else if (msg.role === "tool") {
      turns.push(`TOOL:\n${text}`);
    } else {
      turns.push(`${msg.role.toUpperCase()}:\n${text}`);
    }
  }
  let out = "";
  if (systemParts.length) out += `System:\n${systemParts.join("\n\n")}\n\n`;
  out += turns.join("\n\n");
  return out;
}

function buildWarnings(options) {
  const unsupported = [
    "temperature",
    "topP",
    "topK",
    "maxOutputTokens",
    "presencePenalty",
    "frequencyPenalty",
    "seed",
  ];
  const warnings = [];
  for (const key of unsupported) {
    if (options[key] !== undefined) warnings.push({ type: "unsupported-setting", setting: key });
  }
  if (options.stopSequences?.length) warnings.push({ type: "unsupported-setting", setting: "stopSequences" });
  if (options.tools?.length) warnings.push({ type: "unsupported-setting", setting: "tools" });
  if (options.toolChoice) warnings.push({ type: "unsupported-setting", setting: "toolChoice" });
  if (options.responseFormat?.type === "json")
    warnings.push({ type: "unsupported-setting", setting: "responseFormat" });
  return warnings;
}

function extractUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== "object") return emptyUsage();
  const input = rawUsage.input_tokens;
  const output = rawUsage.output_tokens;
  const cacheRead = rawUsage.cache_read_input_tokens;
  const cacheWrite = rawUsage.cache_creation_input_tokens;
  const totalIn = typeof input === "number" ? input + (cacheRead ?? 0) + (cacheWrite ?? 0) : undefined;
  return {
    inputTokens: {
      total: totalIn ?? input,
      noCache: input,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: output,
      text: output,
      reasoning: undefined,
    },
    raw: rawUsage,
  };
}

class ClaudeCliLanguageModel {
  specificationVersion = "v3";
  supportedUrls = {};

  constructor({ modelId, provider, settings }) {
    this.modelId = modelId;
    this.provider = provider;
    this.settings = settings ?? {};
  }

  buildSpawn(promptText) {
    const cmd = this.settings.claudePath ?? "claude";
    const args = [
      "-p",
      promptText,
      "--dangerously-skip-permissions",
      "--model",
      this.modelId,
      "--verbose",
      "--output-format",
      "stream-json",
    ];
    if (Array.isArray(this.settings.extraArgs)) args.push(...this.settings.extraArgs);

    const env = { ...process.env, ...(this.settings.env ?? {}) };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    if (this.settings.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = this.settings.oauthToken;

    return { cmd, args, env, cwd: this.settings.cwd };
  }

  async doStream(options) {
    const promptText = mapPromptToText(options.prompt);
    const warnings = buildWarnings(options);
    const { cmd, args, env, cwd } = this.buildSpawn(promptText);

    const modelId = this.modelId;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings });
        controller.enqueue({
          type: "response-metadata",
          id: randomUUID(),
          timestamp: new Date(),
          modelId,
        });

        let child;
        try {
          child = spawn(cmd, args, { env, cwd, stdio: ["pipe", "pipe", "pipe"] });
        } catch (err) {
          controller.enqueue({ type: "error", error: err });
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "error", raw: "spawn-failed" },
            usage: emptyUsage(),
          });
          controller.close();
          return;
        }

        const textBlocks = new Map();
        const reasoningBlocks = new Map();
        let stdoutBuf = "";
        let stderrBuf = "";
        let usage = emptyUsage();
        let finishReason = mapFinishReason(undefined);
        let resultText;
        let errored = false;

        const ensureBlock = (kind, key) => {
          const store = kind === "text" ? textBlocks : reasoningBlocks;
          let state = store.get(key);
          if (!state) {
            const id = randomUUID();
            state = { id, emitted: "" };
            store.set(key, state);
            controller.enqueue({ type: `${kind}-start`, id });
          }
          return state;
        };

        const emitDelta = (kind, key, fullText) => {
          if (typeof fullText !== "string" || fullText.length === 0) return;
          const state = ensureBlock(kind, key);
          let delta;
          if (fullText.startsWith(state.emitted)) {
            delta = fullText.slice(state.emitted.length);
          } else {
            delta = fullText;
          }
          if (!delta) return;
          state.emitted = state.emitted + delta;
          controller.enqueue({ type: `${kind}-delta`, id: state.id, delta });
        };

        const closeBlocks = () => {
          for (const [, state] of textBlocks) controller.enqueue({ type: "text-end", id: state.id });
          for (const [, state] of reasoningBlocks) controller.enqueue({ type: "reasoning-end", id: state.id });
        };

        const handleAssistant = (event) => {
          const msg = event.message;
          if (!msg || !Array.isArray(msg.content)) return;
          const msgId = typeof msg.id === "string" ? msg.id : "msg";
          msg.content.forEach((part, idx) => {
            if (!part || typeof part !== "object") return;
            const key = `${msgId}:${idx}`;
            if (part.type === "text") emitDelta("text", key, part.text ?? "");
            else if (part.type === "thinking") emitDelta("reasoning", key, part.thinking ?? "");
          });
        };

        const handleResult = (event) => {
          if (event.usage) usage = extractUsage(event.usage);
          finishReason = mapFinishReason(event.stop_reason ?? (event.is_error ? "error" : "end_turn"));
          if (typeof event.result === "string") resultText = event.result;
        };

        const handleEvent = (event) => {
          if (!event || typeof event !== "object" || typeof event.type !== "string") return;
          if (event.type === "assistant") handleAssistant(event);
          else if (event.type === "result") handleResult(event);
        };

        const consumeBuffer = (chunk) => {
          stdoutBuf += chunk;
          let nl;
          while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
            const line = stdoutBuf.slice(0, nl).trim();
            stdoutBuf = stdoutBuf.slice(nl + 1);
            if (!line) continue;
            try {
              handleEvent(JSON.parse(line));
            } catch {
              // ignore non-JSON lines (banners, stderr leaking, etc.)
            }
          }
        };

        child.stdout.setEncoding("utf8");
        child.stdout.on("data", consumeBuffer);
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (d) => {
          stderrBuf += d;
        });

        const onAbort = () => {
          try {
            child.kill("SIGTERM");
          } catch {}
        };
        if (options.abortSignal) {
          if (options.abortSignal.aborted) onAbort();
          else options.abortSignal.addEventListener("abort", onAbort, { once: true });
        }

        child.on("error", (err) => {
          errored = true;
          controller.enqueue({ type: "error", error: err });
          closeBlocks();
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "error", raw: "spawn-error" },
            usage,
          });
          controller.close();
        });

        child.on("close", (code) => {
          if (errored) return;
          if (options.abortSignal) options.abortSignal.removeEventListener("abort", onAbort);
          if (stdoutBuf.trim()) {
            try {
              handleEvent(JSON.parse(stdoutBuf.trim()));
            } catch {}
            stdoutBuf = "";
          }

          if (code !== 0 && textBlocks.size === 0 && reasoningBlocks.size === 0) {
            controller.enqueue({
              type: "error",
              error: new Error(
                `claude CLI exited with code ${code}: ${stderrBuf.slice(0, 800).trim() || "no stderr"}`,
              ),
            });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "error", raw: `exit-${code}` },
              usage,
            });
            controller.close();
            return;
          }

          if (textBlocks.size === 0 && typeof resultText === "string" && resultText.length) {
            emitDelta("text", "__final__", resultText);
          }

          closeBlocks();
          controller.enqueue({ type: "finish", finishReason, usage });
          controller.close();
        });
      },
      cancel() {},
    });

    return { stream, request: { body: promptText } };
  }

  async doGenerate(options) {
    const { stream, request } = await this.doStream(options);
    const reader = stream.getReader();

    const content = [];
    const textByBlock = new Map();
    const reasoningByBlock = new Map();
    let warnings = [];
    let usage = emptyUsage();
    let finishReason = mapFinishReason(undefined);
    let response = { id: randomUUID(), timestamp: new Date(), modelId: this.modelId };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const part = value;
      switch (part.type) {
        case "stream-start":
          warnings = part.warnings ?? [];
          break;
        case "response-metadata":
          response = { id: part.id, timestamp: part.timestamp, modelId: part.modelId };
          break;
        case "text-start": {
          const obj = { type: "text", text: "" };
          textByBlock.set(part.id, obj);
          content.push(obj);
          break;
        }
        case "text-delta": {
          const obj = textByBlock.get(part.id) ?? { type: "text", text: "" };
          if (!textByBlock.has(part.id)) {
            textByBlock.set(part.id, obj);
            content.push(obj);
          }
          obj.text += part.delta;
          break;
        }
        case "reasoning-start": {
          const obj = { type: "reasoning", text: "" };
          reasoningByBlock.set(part.id, obj);
          content.push(obj);
          break;
        }
        case "reasoning-delta": {
          const obj = reasoningByBlock.get(part.id) ?? { type: "reasoning", text: "" };
          if (!reasoningByBlock.has(part.id)) {
            reasoningByBlock.set(part.id, obj);
            content.push(obj);
          }
          obj.text += part.delta;
          break;
        }
        case "finish":
          usage = part.usage;
          finishReason = part.finishReason;
          break;
        case "error":
          throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }

    const filtered = content.filter((p) => (p.type === "text" || p.type === "reasoning" ? p.text.length > 0 : true));

    return {
      content: filtered,
      usage,
      finishReason,
      warnings,
      response,
      request,
    };
  }
}

export function createClaudeCli(options = {}) {
  const { name, defaultSettings, ...rest } = options ?? {};
  const baseSettings = { ...(defaultSettings ?? {}), ...rest };
  const providerId = name || DEFAULT_PROVIDER_ID;

  const createModel = (modelId, settings) =>
    new ClaudeCliLanguageModel({
      modelId,
      provider: providerId,
      settings: { ...baseSettings, ...(settings ?? {}) },
    });

  const provider = function claudeCli(modelId, settings) {
    if (new.target) throw new Error("claude-cli provider cannot be used with `new`.");
    return createModel(modelId, settings);
  };
  provider.specificationVersion = "v3";
  provider.languageModel = createModel;
  provider.chat = createModel;
  provider.embeddingModel = (modelId) => {
    throw new Error(`Embedding models are not supported by ${providerId} (requested: ${modelId})`);
  };
  provider.imageModel = (modelId) => {
    throw new Error(`Image models are not supported by ${providerId} (requested: ${modelId})`);
  };
  return provider;
}

export default createClaudeCli;
