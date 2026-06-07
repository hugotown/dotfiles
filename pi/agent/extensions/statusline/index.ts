import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CatalogData, ModelMeta } from "./types";
import { readCatalog } from "./catalog/store";
import { isStale, refreshCatalog } from "./catalog/refresh";
import { resolveModel } from "./resolve/cascade";
import { buildStatusText } from "./render/status";
import { buildFooterFactory } from "./render/footer";

// Key used both for ctx.ui.setStatus() (which the custom footer reads) and
// internally to identify the model-meta slot.
const MODEL_META_STATUS_KEY = "model-meta";

export default function (pi: ExtensionAPI) {
  let catalog: CatalogData | null = null;
  let lastRenderedKey: string | null = null;

  // Holder that the footer factory closes over. Each lifecycle event refreshes
  // it so the footer always renders against the latest ExtensionContext.
  const ctxRef: { current: ExtensionContext | null } = { current: null };
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

  async function refreshStatus(ctx: ExtensionContext): Promise<void> {
    const model = ctx.model;
    if (!model) {
      ctx.ui.setStatus(MODEL_META_STATUS_KEY, undefined);
      lastRenderedKey = null;
      return;
    }

    const key = `${model.provider}|${model.id}`;
    if (key === lastRenderedKey) return;

    const cat = await ensureCatalog();
    let meta: ModelMeta;
    if (!cat) {
      meta = { ok: false, piProvider: model.provider, piId: model.id, modelsDevProvider: null, modelsDevId: null, model: null };
    } else {
      meta = await resolveModel({
        catalog: cat,
        piProvider: model.provider,
        piId: model.id,
        activeModel: model,
        authProvider: ctx.modelRegistry,
        signal: ctx.signal,
      });
    }

    ctx.ui.setStatus(MODEL_META_STATUS_KEY, buildStatusText(meta));
    lastRenderedKey = key;
  }

  function ensureFooter(ctx: ExtensionContext): void {
    ctxRef.current = ctx;
    if (footerRegistered) return;
    ctx.ui.setFooter(buildFooterFactory(ctxRef));
    footerRegistered = true;
  }

  pi.on("session_start", async (_event, ctx) => {
    ensureFooter(ctx);
    await refreshStatus(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    ensureFooter(ctx);
    await refreshStatus(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus(MODEL_META_STATUS_KEY, undefined);
    ctx.ui.setFooter(undefined); // restore native footer on shutdown
    ctxRef.current = null;
    footerRegistered = false;
  });
}