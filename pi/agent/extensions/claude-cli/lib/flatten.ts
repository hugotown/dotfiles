import type { Context } from "@earendil-works/pi-ai";

/** Flatten Pi's structured messages into a single prompt string for `claude -p`. */
export function flattenMessages(context: Context): string {
  const parts: string[] = [];

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
