import { complete, type Model } from "@earendil-works/pi-ai";
import type { CatalogData } from "../types";

export interface LlmResult {
  modelsDevProvider: string | null;
  modelsDevId: string | null;
}

function buildPrompt(piProvider: string, piId: string, guessedProvider: string, candidateIds: string[]): string {
  return `You are matching a pi.dev model ID to a models.dev entry.

pi model:
  provider: ${piProvider}
  id: ${piId}

models.dev candidates from provider "${guessedProvider}":
${candidateIds.join("\n")}

Return ONLY a single JSON object:
{ "modelsDevProvider": "<string>", "modelsDevId": "<string|null>" }

If no candidate matches, return { "modelsDevProvider": null, "modelsDevId": null }.`;
}

function parseLlmJson(text: string): LlmResult {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { modelsDevProvider: null, modelsDevId: null };
    const parsed = JSON.parse(m[0]);
    const provider = typeof parsed.modelsDevProvider === "string" ? parsed.modelsDevProvider : null;
    const id = typeof parsed.modelsDevId === "string" ? parsed.modelsDevId : null;
    return { modelsDevProvider: provider, modelsDevId: id };
  } catch {
    return { modelsDevProvider: null, modelsDevId: null };
  }
}

export async function llmResolve(args: {
  catalog: CatalogData;
  piProvider: string;
  piId: string;
  activeModel: Model<any>;
  apiKey: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<LlmResult> {
  const guessedProvider = args.catalog[args.piProvider] ? args.piProvider : args.piProvider;
  const candidates = args.catalog[guessedProvider] ? Object.keys(args.catalog[guessedProvider].models) : [];
  if (candidates.length === 0) return { modelsDevProvider: null, modelsDevId: null };

  const prompt = buildPrompt(args.piProvider, args.piId, guessedProvider, candidates);
  try {
    const response = await complete(
      args.activeModel,
      {
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        }],
      },
      { apiKey: args.apiKey, headers: args.headers, maxTokens: 256, signal: args.signal },
    );
    const text = response.content
      .filter((c: any): c is { type: "text"; text: string } => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return parseLlmJson(text);
  } catch {
    return { modelsDevProvider: null, modelsDevId: null };
  }
}
