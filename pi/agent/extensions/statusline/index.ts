import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CatalogData, ModelMeta } from "./types";
import { readCatalog } from "./catalog/store";
import { isStale, refreshCatalog } from "./catalog/refresh";
import { resolveModel } from "./resolve/cascade";
import { buildFooterFactory } from "./render/footer";

export default function (pi: ExtensionAPI) {
  let catalog: CatalogData | null = null;
  let lastResolvedKey: string | null = null;

  // Refs shared with the footer factory. Updated outside the render loop so
  // render() itself stays synchronous and side-effect free.
  const ctxRef: { current: ExtensionContext | null } = { current: null };
  const metaRef: { current: ModelMeta | null } = { current: null };
  let footerRegistered = false;

  async function ensureCatalog(): Promise<CatalogData | null> {
    if (catalog) return catalog;
    const file = readCatalog();
    if (file) {
      catalog = file.data;
      if (isStale(file.lastSync)) {
        setImmediate(() => {
          refreshCatalog().then((fresh) => { catalog = fresh; }).catch(() => { /* keep stale */ });
        });
      }
      return catalog;
    }
    try {
      catalog = await refreshCatalog();
      return catalog;
    } catch {
      return null;
    }
  }

  async function refreshMeta(ctx: ExtensionContext): Promise<void> {
    const model = ctx.model;
    if (!model) {
      metaRef.current = null;
      lastResolvedKey = null;
      return;
    }

    const key = `${model.provider}|${model.id}`;
    if (key === lastResolvedKey) return;

    const cat = await ensureCatalog();
    if (!cat) {
      metaRef.current = {
        ok: false,
        piProvider: model.provider,
        piId: model.id,
        modelsDevProvider: null,
        modelsDevId: null,
        model: null,
      };
      lastResolvedKey = key;
      return;
    }

    metaRef.current = await resolveModel({
      catalog: cat,
      piProvider: model.provider,
      piId: model.id,
      activeModel: model,
      authProvider: ctx.modelRegistry,
      signal: ctx.signal,
    });
    lastResolvedKey = key;
  }

  function ensureFooter(ctx: ExtensionContext): void {
    ctxRef.current = ctx;
    if (footerRegistered) return;
    ctx.ui.setFooter(buildFooterFactory(ctxRef, metaRef));
    footerRegistered = true;
  }

  pi.on("session_start", async (_event, ctx) => {
    ensureFooter(ctx);
    await refreshMeta(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    ensureFooter(ctx);
    await refreshMeta(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setFooter(undefined); // restore native footer
    ctxRef.current = null;
    metaRef.current = null;
    lastResolvedKey = null;
    footerRegistered = false;
  });
}