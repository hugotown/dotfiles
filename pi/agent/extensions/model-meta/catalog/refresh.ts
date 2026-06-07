import type { CatalogData } from "../types";
import { fetchCatalog } from "./fetch";
import { writeCatalog } from "./store";

export const TTL_MS = 24 * 60 * 60 * 1000;

export function isStale(lastSync: string | null): boolean {
  if (!lastSync) return true;
  const ts = Date.parse(lastSync);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts >= TTL_MS;
}

export async function refreshCatalog(): Promise<CatalogData> {
  const data = await fetchCatalog();
  writeCatalog({ lastSync: new Date().toISOString(), data });
  return data;
}
