import type { CatalogData } from "../types";
import { directLookup, type DirectHit } from "./direct";

export const PROVIDER_ALIASES: Record<string, string[]> = {
  "google-vertex-anthropic": ["anthropic"],
  "amazon-bedrock-anthropic": ["anthropic"],
};

const DATE_SUFFIX = /-\d{8}$/;

function tryCandidates(catalog: CatalogData, providers: string[], ids: string[]): DirectHit | null {
  for (const p of providers) {
    for (const i of ids) {
      const hit = directLookup(catalog, p, i);
      if (hit) return hit;
    }
  }
  return null;
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  const max = Math.min(a.length, b.length);
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function familySearch(catalog: CatalogData, provider: string, id: string): DirectHit | null {
  const p = catalog[provider];
  if (!p) return null;
  const matches: { modelId: string; family: string; releaseDate: string; lcp: number }[] = [];
  for (const [modelId, model] of Object.entries(p.models)) {
    if (!model.family) continue;
    if (id.startsWith(model.family)) {
      matches.push({
        modelId,
        family: model.family,
        releaseDate: model.release_date ?? "",
        lcp: commonPrefixLen(modelId, id),
      });
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.releaseDate !== b.releaseDate) return a.releaseDate < b.releaseDate ? 1 : -1;
    return b.lcp - a.lcp;
  });
  const best = matches[0];
  return { provider, id: best.modelId, model: p.models[best.modelId] };
}

export function heuristicLookup(catalog: CatalogData, provider: string, id: string): DirectHit | null {
  const aliases = PROVIDER_ALIASES[provider] ?? [];
  const providersToTry = [provider, ...aliases];

  // Build transformed id candidates
  const stripped = id.includes("@") ? id.slice(0, id.indexOf("@")) : id;
  const noDate = stripped.replace(DATE_SUFFIX, "");
  const lower = noDate.toLowerCase();
  const ids = Array.from(new Set([stripped, noDate, lower]));

  // Rules 1-4: direct retries
  const directHit = tryCandidates(catalog, providersToTry, ids);
  if (directHit) return directHit;

  // Rule 5: family search across each provider candidate
  for (const p of providersToTry) {
    for (const candidateId of ids) {
      const hit = familySearch(catalog, p, candidateId);
      if (hit) return hit;
    }
  }
  return null;
}
