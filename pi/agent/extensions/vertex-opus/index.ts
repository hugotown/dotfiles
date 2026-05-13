/**
 * vertex-opus — Pi extension that registers Anthropic's Claude Opus 4.7
 * (and other Claude models on Vertex) as a custom provider.
 *
 * Auth: Application Default Credentials (ADC). No API key needed.
 *   Make sure you have run:  gcloud auth application-default login
 *
 * The @anthropic-ai/vertex-sdk client picks up ADC automatically via
 * google-auth-library. We pass a dummy `apiKey` to Pi only because the
 * provider config validation requires SOMETHING in that field — the value
 * is never sent on the wire (the SDK uses Bearer tokens minted from ADC).
 *
 * Project & region come from environment variables:
 *   GOOGLE_CLOUD_PROJECT  — required (e.g. "alom-6dc47")
 *   GOOGLE_CLOUD_LOCATION — optional, default "global"
 *
 * Adapted from:
 *   https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-provider-anthropic/index.ts
 */

import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import type {
	ContentBlockParam,
	MessageCreateParamsStreaming,
} from "@anthropic-ai/sdk/resources/messages.js";
import {
	type Api,
	type AssistantMessage,
	type AssistantMessageEventStream,
	type Context,
	calculateCost,
	createAssistantMessageEventStream,
	type ImageContent,
	type Message,
	type Model,
	type SimpleStreamOptions,
	type StopReason,
	type TextContent,
	type ThinkingContent,
	type Tool,
	type ToolCall,
	type ToolResultMessage,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Configuration (read at extension load time)
// ---------------------------------------------------------------------------

const PROJECT_ID =
	process.env.GOOGLE_CLOUD_PROJECT || process.env.ANTHROPIC_VERTEX_PROJECT_ID || "";
const REGION =
	process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || "global";

// ---------------------------------------------------------------------------
// Helpers (pure data conversion, copied from the official anthropic example)
// ---------------------------------------------------------------------------

function sanitizeSurrogates(text: string): string {
	return text.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function convertContentBlocks(
	content: (TextContent | ImageContent)[],
): string | Array<{ type: "text"; text: string } | { type: "image"; source: any }> {
	const hasImages = content.some((c) => c.type === "image");
	if (!hasImages) {
		return sanitizeSurrogates(content.map((c) => (c as TextContent).text).join("\n"));
	}

	const blocks = content.map((block) => {
		if (block.type === "text") {
			return { type: "text" as const, text: sanitizeSurrogates(block.text) };
		}
		return {
			type: "image" as const,
			source: {
				type: "base64" as const,
				media_type: block.mimeType,
				data: block.data,
			},
		};
	});

	if (!blocks.some((b) => b.type === "text")) {
		blocks.unshift({ type: "text" as const, text: "(see attached image)" });
	}

	return blocks;
}

function convertMessages(messages: Message[]): any[] {
	const params: any[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];

		if (msg.role === "user") {
			if (typeof msg.content === "string") {
				if (msg.content.trim()) {
					params.push({ role: "user", content: sanitizeSurrogates(msg.content) });
				}
			} else {
				const blocks: ContentBlockParam[] = msg.content.map((item) =>
					item.type === "text"
						? { type: "text" as const, text: sanitizeSurrogates(item.text) }
						: {
								type: "image" as const,
								source: {
									type: "base64" as const,
									media_type: item.mimeType as any,
									data: item.data,
								},
							},
				);
				if (blocks.length > 0) {
					params.push({ role: "user", content: blocks });
				}
			}
		} else if (msg.role === "assistant") {
			const blocks: ContentBlockParam[] = [];
			for (const block of msg.content) {
				if (block.type === "text" && block.text.trim()) {
					blocks.push({ type: "text", text: sanitizeSurrogates(block.text) });
				} else if (block.type === "thinking" && block.thinking.trim()) {
					if ((block as ThinkingContent).thinkingSignature) {
						blocks.push({
							type: "thinking" as any,
							thinking: sanitizeSurrogates(block.thinking),
							signature: (block as ThinkingContent).thinkingSignature!,
						});
					} else {
						blocks.push({ type: "text", text: sanitizeSurrogates(block.thinking) });
					}
				} else if (block.type === "toolCall") {
					blocks.push({
						type: "tool_use",
						id: block.id,
						name: block.name,
						input: block.arguments,
					});
				}
			}
			if (blocks.length > 0) {
				params.push({ role: "assistant", content: blocks });
			}
		} else if (msg.role === "toolResult") {
			const toolResults: any[] = [];
			toolResults.push({
				type: "tool_result",
				tool_use_id: msg.toolCallId,
				content: convertContentBlocks(msg.content),
				is_error: msg.isError,
			});

			let j = i + 1;
			while (j < messages.length && messages[j].role === "toolResult") {
				const nextMsg = messages[j] as ToolResultMessage;
				toolResults.push({
					type: "tool_result",
					tool_use_id: nextMsg.toolCallId,
					content: convertContentBlocks(nextMsg.content),
					is_error: nextMsg.isError,
				});
				j++;
			}
			i = j - 1;
			params.push({ role: "user", content: toolResults });
		}
	}

	// Cache-control on the last user message (Anthropic prompt caching)
	if (params.length > 0) {
		const last = params[params.length - 1];
		if (last.role === "user" && Array.isArray(last.content)) {
			const lastBlock = last.content[last.content.length - 1];
			if (lastBlock) {
				lastBlock.cache_control = { type: "ephemeral" };
			}
		}
	}

	return params;
}

function convertTools(tools: Tool[]): any[] {
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: "object",
			properties: (tool.parameters as any).properties || {},
			required: (tool.parameters as any).required || [],
		},
	}));
}

function mapStopReason(reason: string): StopReason {
	switch (reason) {
		case "end_turn":
		case "pause_turn":
		case "stop_sequence":
			return "stop";
		case "max_tokens":
			return "length";
		case "tool_use":
			return "toolUse";
		default:
			return "error";
	}
}

// ---------------------------------------------------------------------------
// Stream implementation
// ---------------------------------------------------------------------------

function streamVertexAnthropic(
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

		try {
			if (!PROJECT_ID) {
				throw new Error(
					"GOOGLE_CLOUD_PROJECT (or ANTHROPIC_VERTEX_PROJECT_ID) is not set",
				);
			}

			const client = new AnthropicVertex({
				region: REGION,
				projectId: PROJECT_ID,
			});

			const params: MessageCreateParamsStreaming = {
				// On Vertex, the SDK strips this and uses the URL path instead,
				// but it must still be a valid id matching the URL model segment.
				model: model.id,
				messages: convertMessages(context.messages),
				max_tokens: options?.maxTokens || Math.floor(model.maxTokens / 3),
				stream: true,
			};

			if (context.systemPrompt) {
				params.system = [
					{
						type: "text",
						text: sanitizeSurrogates(context.systemPrompt),
						cache_control: { type: "ephemeral" },
					},
				];
			}

			if (context.tools && context.tools.length > 0) {
				params.tools = convertTools(context.tools);
			}

			// Extended thinking on Claude Opus 4.7.
			//
			// Manual `thinking: {type: "enabled", budget_tokens: N}` is REJECTED
			// by Opus 4.7 with a 400 error. The model only accepts adaptive
			// thinking, configured via `thinking.type = "adaptive"` plus an
			// effort hint via top-level `output_config.effort`.
			//
			// Effort is hardcoded to "xhigh" per user preference. Per Anthropic's
			// docs, "xhigh" is the recommended starting point for coding and
			// agentic workflows on Opus 4.7. Valid values if you ever need to
			// change it: "low" | "medium" | "high" | "xhigh" | "max".
			//
			// We also opt in to summarized thinking display because Opus 4.7's
			// default is "omitted" (empty thinking blocks → Pi can't show
			// reasoning summary). Set to "omitted" if you want lower latency and
			// don't care about seeing the thinking content.
			//
			// Casts via `as any` because the @anthropic-ai/sdk type defs we
			// import don't yet model the adaptive/output_config fields. The
			// fields are passed straight to the Vertex JSON body at runtime.
			if (options?.reasoning && model.reasoning) {
				(params as any).thinking = {
					type: "adaptive",
					display: "summarized",
				};
				(params as any).output_config = { effort: "xhigh" };
			}

			const anthropicStream = client.messages.stream(
				{ ...params },
				{ signal: options?.signal },
			);

			stream.push({ type: "start", partial: output });

			type Block = (
				| ThinkingContent
				| TextContent
				| (ToolCall & { partialJson: string })
			) & { index: number };
			const blocks = output.content as Block[];

			for await (const event of anthropicStream as any) {
				if (event.type === "message_start") {
					output.usage.input = event.message.usage.input_tokens || 0;
					output.usage.output = event.message.usage.output_tokens || 0;
					output.usage.cacheRead =
						(event.message.usage as any).cache_read_input_tokens || 0;
					output.usage.cacheWrite =
						(event.message.usage as any).cache_creation_input_tokens || 0;
					output.usage.totalTokens =
						output.usage.input +
						output.usage.output +
						output.usage.cacheRead +
						output.usage.cacheWrite;
					calculateCost(model, output.usage);
				} else if (event.type === "content_block_start") {
					if (event.content_block.type === "text") {
						output.content.push({
							type: "text",
							text: "",
							index: event.index,
						} as any);
						stream.push({
							type: "text_start",
							contentIndex: output.content.length - 1,
							partial: output,
						});
					} else if (event.content_block.type === "thinking") {
						output.content.push({
							type: "thinking",
							thinking: "",
							thinkingSignature: "",
							index: event.index,
						} as any);
						stream.push({
							type: "thinking_start",
							contentIndex: output.content.length - 1,
							partial: output,
						});
					} else if (event.content_block.type === "tool_use") {
						output.content.push({
							type: "toolCall",
							id: event.content_block.id,
							name: event.content_block.name,
							arguments: {},
							partialJson: "",
							index: event.index,
						} as any);
						stream.push({
							type: "toolcall_start",
							contentIndex: output.content.length - 1,
							partial: output,
						});
					}
				} else if (event.type === "content_block_delta") {
					const index = blocks.findIndex((b) => b.index === event.index);
					const block = blocks[index];
					if (!block) continue;

					if (event.delta.type === "text_delta" && block.type === "text") {
						block.text += event.delta.text;
						stream.push({
							type: "text_delta",
							contentIndex: index,
							delta: event.delta.text,
							partial: output,
						});
					} else if (
						event.delta.type === "thinking_delta" &&
						block.type === "thinking"
					) {
						block.thinking += event.delta.thinking;
						stream.push({
							type: "thinking_delta",
							contentIndex: index,
							delta: event.delta.thinking,
							partial: output,
						});
					} else if (
						event.delta.type === "input_json_delta" &&
						block.type === "toolCall"
					) {
						(block as any).partialJson += event.delta.partial_json;
						try {
							block.arguments = JSON.parse((block as any).partialJson);
						} catch {
							// fragment not yet a complete JSON object; keep accumulating
						}
						stream.push({
							type: "toolcall_delta",
							contentIndex: index,
							delta: event.delta.partial_json,
							partial: output,
						});
					} else if (
						event.delta.type === "signature_delta" &&
						block.type === "thinking"
					) {
						block.thinkingSignature =
							(block.thinkingSignature || "") + (event.delta as any).signature;
					}
				} else if (event.type === "content_block_stop") {
					const index = blocks.findIndex((b) => b.index === event.index);
					const block = blocks[index];
					if (!block) continue;

					delete (block as any).index;
					if (block.type === "text") {
						stream.push({
							type: "text_end",
							contentIndex: index,
							content: block.text,
							partial: output,
						});
					} else if (block.type === "thinking") {
						stream.push({
							type: "thinking_end",
							contentIndex: index,
							content: block.thinking,
							partial: output,
						});
					} else if (block.type === "toolCall") {
						try {
							block.arguments = JSON.parse((block as any).partialJson);
						} catch {
							// leave arguments as best-effort partial
						}
						delete (block as any).partialJson;
						stream.push({
							type: "toolcall_end",
							contentIndex: index,
							toolCall: block,
							partial: output,
						});
					}
				} else if (event.type === "message_delta") {
					if ((event.delta as any).stop_reason) {
						output.stopReason = mapStopReason((event.delta as any).stop_reason);
					}
					output.usage.input = (event.usage as any).input_tokens || 0;
					output.usage.output = (event.usage as any).output_tokens || 0;
					output.usage.cacheRead =
						(event.usage as any).cache_read_input_tokens || 0;
					output.usage.cacheWrite =
						(event.usage as any).cache_creation_input_tokens || 0;
					output.usage.totalTokens =
						output.usage.input +
						output.usage.output +
						output.usage.cacheRead +
						output.usage.cacheWrite;
					calculateCost(model, output.usage);
				}
			}

			if (options?.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			stream.push({
				type: "done",
				reason: output.stopReason as "stop" | "length" | "toolUse",
				message: output,
			});
			stream.end();
		} catch (error) {
			for (const block of output.content) delete (block as any).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage =
				error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({
				type: "error",
				reason: output.stopReason,
				error: output,
			});
			stream.end();
		}
	})();

	return stream;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	pi.registerProvider("vertex-anthropic", {
		name: "Anthropic on Vertex AI",
		// baseUrl is informational here — AnthropicVertex SDK builds the real
		// URL from region + projectId at request time.
		baseUrl: `https://${REGION}-aiplatform.googleapis.com`,
		// Pi requires a non-empty apiKey when models are defined, but the
		// SDK uses ADC (gcloud) so this value is never sent on the wire.
		apiKey: "_uses_gcloud_adc",
		api: "vertex-anthropic-stream",
		streamSimple: streamVertexAnthropic,
		models: [
			{
				// Vertex version-qualified id: <model>@<versionAlias>.
				// `@default` is the alias that always points to the active stable
				// version, per Vertex AI Model Registry conventions.
				id: "claude-opus-4-7@default",
				name: "Claude Opus 4.7 (Vertex)",
				reasoning: true,
				input: ["text", "image"],
				// Per Anthropic's Opus 4.x pricing on Vertex (USD per 1M tokens).
				// Update if Vertex publishes different numbers for 4.7.
				cost: {
					input: 15.0,
					output: 75.0,
					cacheRead: 1.5,
					cacheWrite: 18.75,
				},
				// Docs claim 1M input context; that's behind a beta header today.
				// 200K is the safe default. Bump to 1_000_000 if you enable beta.
				contextWindow: 200_000,
				// Anthropic recommends 64K when running Opus 4.7 at xhigh effort
				// so the model has room to think and act across tool calls.
				// Opus 4.7 supports up to 128K output if you need to bump this.
				maxTokens: 64_000,
			},
		],
	});
}
