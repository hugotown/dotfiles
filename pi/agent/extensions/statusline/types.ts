// Mirror of one model entry from models.dev api.json
export interface CatalogModel {
  id: string;
  name: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  knowledge?: string;          // e.g. "2026-01"
  release_date?: string;       // e.g. "2025-11-01" or "2025-11"
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number };
}

// Mirror of one provider block from models.dev api.json
export interface CatalogProvider {
  id: string;
  name?: string;
  models: Record<string, CatalogModel>;
}

// Top-level api.json shape (only what we use)
export type CatalogData = Record<string, CatalogProvider>;

// Persisted catalog.json structure
export interface CatalogFile {
  lastSync: string;             // ISO timestamp
  data: CatalogData;
}

// Equivalence cache entry (only persisted for "llm" and "unresolved")
export interface EquivalenceEntry {
  modelsDevProvider: string | null;
  modelsDevId: string | null;
  resolvedVia: "llm" | "unresolved";
  resolvedAt: string;
}

// Persisted equivalences.json structure
export interface EquivalencesFile {
  lastSync: string;
  entries: Record<string, EquivalenceEntry>; // key = `${piProvider}|${piId}`
}

// Resolved meta passed to the renderer
export interface ModelMeta {
  ok: boolean;                  // true if direct/heuristic/cache hit with a real model
  piProvider: string;
  piId: string;
  modelsDevProvider: string | null;
  modelsDevId: string | null;
  model: CatalogModel | null;   // null when unresolved
}