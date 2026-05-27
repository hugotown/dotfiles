/**
 * Shared GenerateContentConfig builder for the text-in/text-out tasks
 * (document processing, image understanding). Field names verified against the
 * @google/genai GenerateContentConfig / ThinkingConfig interfaces:
 *   - structured JSON  → responseMimeType + responseJsonSchema (raw JSON schema)
 *   - system prompt    → systemInstruction (accepts a plain string)
 *   - reasoning budget → thinkingConfig.thinkingBudget (0 = off, -1 = automatic)
 */
export interface TextGenOptions {
  json?: boolean;
  /** Raw JSON Schema string; applied only when `json` is true. */
  schema?: string;
  systemInstruction?: string;
  /** "" / "default" omit, "auto" → -1, "off"/"none" → 0, else token count. */
  thinkingBudget?: string | number;
}

function parseThinkingBudget(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const t = raw.trim().toLowerCase();
  if (t === "" || t === "default") return undefined;
  if (t === "auto") return -1;
  if (t === "off" || t === "none") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function buildTextGenConfig(o: TextGenOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (o.json) {
    config.responseMimeType = "application/json";
    if (o.schema && o.schema.trim()) {
      try {
        config.responseJsonSchema = JSON.parse(o.schema);
      } catch {
        throw new Error("Invalid --schema: expected a raw JSON Schema string.");
      }
    }
  }

  if (o.systemInstruction && o.systemInstruction.trim()) {
    config.systemInstruction = o.systemInstruction;
  }

  const budget = parseThinkingBudget(o.thinkingBudget);
  if (budget !== undefined) config.thinkingConfig = { thinkingBudget: budget };

  return config;
}
