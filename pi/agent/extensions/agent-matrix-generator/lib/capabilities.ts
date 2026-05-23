import { CAPS_API_URL, FETCH_TIMEOUT_MS } from "./constants";
import { log } from "./log";
import type { ApiModel, CapsByProvider, ModelCaps } from "../types";

export async function fetchCapabilities(): Promise<CapsByProvider> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CAPS_API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const api = (await res.json()) as Record<
      string,
      { models?: Record<string, ApiModel> }
    >;
    const byProvider: CapsByProvider = new Map();
    for (const [providerId, provider] of Object.entries(api)) {
      const models = provider.models ?? {};
      const perModel = new Map<string, ModelCaps>();
      for (const [modelId, model] of Object.entries(models)) {
        perModel.set(modelId, {
          input: Array.isArray(model.modalities?.input)
            ? model.modalities.input
            : [],
          toolCall: !!model.tool_call,
          reasoning: !!model.reasoning,
          attachment: !!model.attachment,
        });
      }
      byProvider.set(providerId, perModel);
    }
    return byProvider;
  } catch (err) {
    log("capability fetch failed; agents with requirements will be skipped", {
      error: String(err),
    });
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cross-provider union lookup. Proxies like github-copilot under-report caps;
 * we treat the union across all providers listing this modelId as truth.
 * Normalizes dots ↔ dashes for alias matching.
 */
export function lookupCaps(
  byProvider: CapsByProvider,
  providerId: string,
  modelId: string,
): { caps: ModelCaps | undefined; fellBack: boolean } {
  const norm = (s: string) => s.replace(/\./g, "-");
  const target = norm(modelId);

  const mergedInput = new Set<string>();
  let toolCall = false;
  let reasoning = false;
  let attachment = false;
  let exactSeen = false;
  let anySeen = false;

  for (const [pid, models] of byProvider) {
    for (const [mid, caps] of models) {
      if (norm(mid) !== target) continue;
      anySeen = true;
      if (pid === providerId && mid === modelId) exactSeen = true;
      for (const t of caps.input) mergedInput.add(t);
      if (caps.toolCall) toolCall = true;
      if (caps.reasoning) reasoning = true;
      if (caps.attachment) attachment = true;
    }
  }

  if (!anySeen) return { caps: undefined, fellBack: false };
  return {
    caps: { input: Array.from(mergedInput), toolCall, reasoning, attachment },
    fellBack: !exactSeen,
  };
}
