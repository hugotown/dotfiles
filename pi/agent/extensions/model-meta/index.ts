import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CatalogData, ModelMeta } from "./types";
import { readCatalog } from "./catalog/store";
import { isStale, refreshCatalog } from "./catalog/refresh";
import { resolveModel } from "./resolve/cascade";
import { buildWidgetFactory } from "./render/widget";

const WIDGET_KEY = "model-meta";

export default function (pi: ExtensionAPI) {
  let catalog: CatalogData | null = null;
  let lastRenderedKey: string | null = null;

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

  async function renderForCurrentModel(ctx: ExtensionContext): Promise<void> {
    const model = ctx.model;
    if (!model) {
      ctx.ui.setWidget(WIDGET_KEY, undefined);
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

    // Card now uses emoji in header; PNG logo pipeline kept on disk but unused.
    ctx.ui.setWidget(WIDGET_KEY, buildWidgetFactory(meta, null), { placement: "belowEditor" });
    lastRenderedKey = key;
  }

  pi.on("session_start", async (_event, ctx) => {
    await renderForCurrentModel(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    await renderForCurrentModel(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setWidget(WIDGET_KEY, undefined);
  });
}
