// Handle individual stream events from claude CLI's stream-json output.

import type { AssistantMessage, AssistantMessageEventStream, TextContent } from "@earendil-works/pi-ai";

export function handleStreamEvent(
  ev: any, output: AssistantMessage,
  activeBlocks: Map<number, { type: "text" | "thinking"; contentIndex: number }>,
  stream: AssistantMessageEventStream, applyUsage: (u: any) => void,
): void {
  if (!ev) return;
  if (ev.type === "content_block_start") {
    const blockType = ev.content_block?.type;
    if (blockType === "text") {
      const contentIndex = output.content.length;
      output.content.push({ type: "text", text: "" } as TextContent);
      activeBlocks.set(ev.index, { type: "text", contentIndex });
      stream.push({ type: "text_start", contentIndex, partial: output });
    } else if (blockType === "thinking") {
      const contentIndex = output.content.length;
      output.content.push({ type: "thinking", thinking: "", thinkingSignature: "" });
      activeBlocks.set(ev.index, { type: "thinking", contentIndex });
      stream.push({ type: "thinking_start", contentIndex, partial: output });
    }
  } else if (ev.type === "content_block_delta") {
    const block = activeBlocks.get(ev.index);
    if (!block) return;
    const delta = ev.delta;
    if (block.type === "text" && delta?.type === "text_delta") {
      const text = delta.text ?? "";
      (output.content[block.contentIndex] as TextContent).text += text;
      stream.push({ type: "text_delta", contentIndex: block.contentIndex, delta: text, partial: output });
    } else if (block.type === "thinking" && delta?.type === "thinking_delta") {
      const text = delta.thinking ?? "";
      (output.content[block.contentIndex] as any).thinking += text;
      stream.push({ type: "thinking_delta", contentIndex: block.contentIndex, delta: text, partial: output });
    } else if (block.type === "thinking" && delta?.type === "signature_delta") {
      (output.content[block.contentIndex] as any).thinkingSignature = delta.signature ?? "";
    }
  } else if (ev.type === "content_block_stop") {
    const block = activeBlocks.get(ev.index);
    if (!block) return;
    if (block.type === "text") {
      stream.push({ type: "text_end", contentIndex: block.contentIndex, content: (output.content[block.contentIndex] as TextContent).text, partial: output });
    } else if (block.type === "thinking") {
      stream.push({ type: "thinking_end", contentIndex: block.contentIndex, content: (output.content[block.contentIndex] as any).thinking, partial: output });
    }
    activeBlocks.delete(ev.index);
  } else if (ev.type === "message_delta") {
    applyUsage(ev.usage);
    if (ev.delta?.stop_reason === "end_turn") output.stopReason = "stop";
    else if (ev.delta?.stop_reason === "max_tokens") output.stopReason = "length";
  }
}
