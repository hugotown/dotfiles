import * as fs from "node:fs";
import type { Model } from "@earendil-works/pi-ai";
import type { CatalogData, EquivalencesFile, ModelMeta } from "../types";
import { directLookup } from "./direct";
import { heuristicLookup } from "./heuristic";
import { llmResolve } from "./llm";
import { ensureCacheDirs, equivalencesPath } from "../lib/paths";

const EMPTY: EquivalencesFile = { lastSync: new Date(0).toISOString(), entries: {} };

export function loadEquivalences(): EquivalencesFile {
  try {
    const raw = fs.readFileSync(equivalencesPath(), "utf8");
    const parsed = JSON.parse(raw) as EquivalencesFile;
    if (!parsed || typeof parsed.lastSync !== "string" || typeof parsed.entries !== "object") {
      throw new Error("malformed");
    }
    return parsed;
  } catch (e) {
    // Corrupt → back up and start fresh
    try {
      if (fs.existsSync(equivalencesPath())) {
        fs.renameSync(equivalencesPath(), `${equivalencesPath()}.bak`);
      }
    } catch { /* ignore */ }
    return { ...EMPTY };
  }
}

export function saveEquivalences(file: EquivalencesFile): void {
  ensureCacheDirs();
  const tmp = `${equivalencesPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file));
  fs.renameSync(tmp, equivalencesPath());
}

function makeMeta(piProvider: string, piId: string, hit: { provider: string; id: string; model: any } | null): ModelMeta {
  if (!hit) {
    return { ok: false, piProvider, piId, modelsDevProvider: null, modelsDevId: null, model: null };
  }
  return { ok: true, piProvider, piId, modelsDevProvider: hit.provider, modelsDevId: hit.id, model: hit.model };
}

export async function resolveModel(args: {
  catalog: CatalogData;
  piProvider: string;
  piId: string;
  activeModel: Model<any> | undefined;
  authProvider?: {
    getApiKeyAndHeaders(model: Model<any>): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }>;
  };
  signal?: AbortSignal;
}): Promise<ModelMeta> {
  const { catalog, piProvider, piId } = args;

  // 1. direct
  const d = directLookup(catalog, piProvider, piId);
  if (d) return makeMeta(piProvider, piId, d);

  // 2. heuristic
  const h = heuristicLookup(catalog, piProvider, piId);
  if (h) return makeMeta(piProvider, piId, h);

  // 3. equivalences cache
  const equivalences = loadEquivalences();
  const key = `${piProvider}|${piId}`;
  const cached = equivalences.entries[key];
  if (cached) {
    if (cached.resolvedVia === "unresolved" || !cached.modelsDevProvider || !cached.modelsDevId) {
      return makeMeta(piProvider, piId, null);
    }
    const cachedHit = directLookup(catalog, cached.modelsDevProvider, cached.modelsDevId);
    if (cachedHit) return makeMeta(piProvider, piId, cachedHit);
    // upstream removed it; fall through to LLM
  }

  // 4. LLM (requires active model + auth)
  if (!args.activeModel || !args.authProvider) {
    equivalences.entries[key] = { modelsDevProvider: null, modelsDevId: null, resolvedVia: "unresolved", resolvedAt: new Date().toISOString() };
    equivalences.lastSync = new Date().toISOString();
    saveEquivalences(equivalences);
    return makeMeta(piProvider, piId, null);
  }
  const auth = await args.authProvider.getApiKeyAndHeaders(args.activeModel);
  if (!auth.ok || !auth.apiKey) {
    equivalences.entries[key] = { modelsDevProvider: null, modelsDevId: null, resolvedVia: "unresolved", resolvedAt: new Date().toISOString() };
    equivalences.lastSync = new Date().toISOString();
    saveEquivalences(equivalences);
    return makeMeta(piProvider, piId, null);
  }

  const llm = await llmResolve({
    catalog, piProvider, piId,
    activeModel: args.activeModel,
    apiKey: auth.apiKey, headers: auth.headers, signal: args.signal,
  });

  if (llm.modelsDevProvider && llm.modelsDevId) {
    const llmHit = directLookup(catalog, llm.modelsDevProvider, llm.modelsDevId);
    equivalences.entries[key] = {
      modelsDevProvider: llmHit ? llm.modelsDevProvider : null,
      modelsDevId: llmHit ? llm.modelsDevId : null,
      resolvedVia: llmHit ? "llm" : "unresolved",
      resolvedAt: new Date().toISOString(),
    };
    equivalences.lastSync = new Date().toISOString();
    saveEquivalences(equivalences);
    return makeMeta(piProvider, piId, llmHit);
  }

  // 5. unresolved
  equivalences.entries[key] = { modelsDevProvider: null, modelsDevId: null, resolvedVia: "unresolved", resolvedAt: new Date().toISOString() };
  equivalences.lastSync = new Date().toISOString();
  saveEquivalences(equivalences);
  return makeMeta(piProvider, piId, null);
}
