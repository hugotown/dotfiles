import type { CatalogData, CatalogModel } from "../types";

export interface DirectHit {
  provider: string;
  id: string;
  model: CatalogModel;
}

export function directLookup(catalog: CatalogData, provider: string, id: string): DirectHit | null {
  const p = catalog[provider];
  if (!p) return null;
  const m = p.models?.[id];
  if (!m) return null;
  return { provider, id, model: m };
}
