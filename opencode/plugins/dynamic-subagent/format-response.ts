import type { SubagentResponse } from "./types";

export function formatSubagentResponse(
  agent: string,
  response: SubagentResponse,
): string {
  const text = response.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
  const { info } = response;
  const stats = [
    `${info.providerID}/${info.modelID}`,
    info.tokens
      ? `in=${info.tokens.input ?? 0} out=${info.tokens.output ?? 0}`
      : undefined,
    typeof info.cost === "number" ? `$${info.cost.toFixed(4)}` : undefined,
    info.error ? `ERROR: ${JSON.stringify(info.error)}` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");

  return `[${agent} | ${stats}]\n\n${text || "(no text output)"}`;
}
