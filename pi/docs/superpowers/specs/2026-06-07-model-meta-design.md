# Spec: `model-meta` extension

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan
**Location:** `~/.config/pi/agent/extensions/model-meta/`

## Goal

Show metadata about the currently active model in a 2-line widget directly below the pi.dev TUI editor. Data comes from [models.dev](https://models.dev/api.json) and includes name, provider, input/output price, capabilities (image, pdf, reasoning, tools), context/output limits, knowledge cutoff, and the provider logo rendered inline via the Kitty graphics protocol.

The widget refreshes on every model change (via the native `model_select` event).

## Non-goals

- No `/model-meta` commands (no manual refresh, no clear, no show). Cache lifecycle is fully automatic.
- No flag registration. No tool registration. No LLM behavior changes.
- No telemetry, no usage history.
- No manual editor for the equivalence table.
- No proactive install of system dependencies.

## Architecture

### File layout

```
~/.config/pi/agent/extensions/model-meta/
├── index.ts              # wiring: session_start, model_select, session_shutdown
├── catalog/
│   ├── fetch.ts          # HTTPS GET https://models.dev/api.json
│   ├── store.ts          # read/write ~/.pi/cache/model-meta/catalog.json
│   └── refresh.ts        # TTL 24h policy + background refresh
├── resolve/
│   ├── direct.ts         # api.json[provider].models[id] lookup
│   ├── heuristic.ts      # normalize + family + alias matching
│   ├── llm.ts            # LLM fallback (one call per unknown model, ever)
│   └── cascade.ts        # orchestrates direct → heuristic → cache → llm
├── render/
│   ├── widget.ts         # builds the 2-line widget Component
│   ├── format.ts         # price / capabilities / ctx / knowledge formatters
│   └── icons.ts          # capability → emoji mapping
├── logo/
│   ├── download.ts       # fetch /logos/{provider}.svg with disk cache
│   └── rasterize.ts      # rsvg-convert → PNG → base64
├── lib/
│   └── paths.ts          # ~/.pi/cache/model-meta/ path helpers
└── types.ts              # ModelMeta, CatalogEntry, EquivalenceEntry
```

All files target ≤70 lines (hard cap 120). No `package.json`, no `node_modules/`. Imports limited to:

- `@earendil-works/pi-coding-agent` (events, ExtensionAPI, ExtensionContext)
- `@earendil-works/pi-tui` (Image, Text, Container, Component)
- `@earendil-works/pi-ai` (complete — only used by `resolve/llm.ts`)
- Node built-ins (`node:fs`, `node:path`, `node:https`, `node:child_process`)

## Data flow

### Lifecycle

```
session_start (any reason)
  ├─ loadCatalog (sync if missing, async refresh if stale)
  ├─ loadEquivalences
  ├─ resolveCurrentModel(ctx.model)
  └─ renderWidget(ctx, meta)

model_select { model, previousModel, source }
  └─ resolveCurrentModel(event.model)
     └─ renderWidget(ctx, meta)

session_shutdown
  └─ ctx.ui.setWidget("model-meta", undefined)
```

### Resolution cascade

```
ctx.model { provider, id }
   │
   ▼
1. direct: api.json[provider].models[id]               ── hit (majority case)
   │ miss
   ▼
2. heuristic: normalize + family + alias                ── hit (most of the rest)
   │ miss
   ▼
3. equivalence cache (incremental, never cleared)      ── hit (second time)
   │ miss
   ▼
4. LLM call (once per orphan, ever) → write to cache    ── hit, persisted
   │ failure
   ▼
5. degraded render: "[?] <id> · <provider>"
```

A successful direct or heuristic match is NOT written to the equivalence cache — it's cheap to recompute. Only `llm` and `unresolved` outcomes are persisted, so the cache stays small and meaningful.

### Heuristic rules (deterministic)

Applied in order, first hit wins:

1. **Strip suffix:** `claude-opus-4-7@default` → `claude-opus-4-7`. Retry direct.
2. **Strip date suffix:** `claude-haiku-4-5-20251001` → `claude-haiku-4-5`. Retry direct.
3. **Lowercase normalize:** `GPT-4o` → `gpt-4o`. Retry direct.
4. **Provider alias:** known map of pi-provider → models.dev provider when they differ. Example: `google-vertex-anthropic` → also try `anthropic`. Retry direct with each candidate.
5. **Family search:** scan provider models for an entry whose `family` is a prefix of the pi id (e.g. `claude-opus` matches `claude-opus-4-7-something`).

All five rules combined: ~60 LOC.

### LLM fallback prompt

Only invoked when steps 1–3 fail AND `ctx.model` exists (cannot use the active model to resolve itself if there's no model). Uses `complete()` from `@earendil-works/pi-ai` with the active model.

```
You are matching a pi.dev model ID to a models.dev entry.

pi model:
  provider: ${piProvider}
  id: ${piId}

models.dev candidates from provider "${guessedProvider}":
${candidateIds.join("\n")}

Return ONLY a single JSON object:
{ "modelsDevProvider": "<string>", "modelsDevId": "<string|null>" }

If no candidate matches, return { "modelsDevProvider": null, "modelsDevId": null }.
```

`guessedProvider` falls back to the pi provider name if no alias known. `candidateIds` is the full list of model IDs under that provider in api.json (typically 5-50 entries, ~200 input tokens).

Response is parsed with strict JSON.parse + schema validation. Invalid response → record as `unresolved`, don't retry. The user always sees a degraded but stable widget.

## Cache files

All under `~/.pi/cache/model-meta/`:

### `catalog.json`

Mirror of the latest successful `api.json` fetch.

```json
{
  "lastSync": "2026-06-07T14:23:11.000Z",
  "data": { /* full api.json from models.dev, ~2-5MB */ }
}
```

### `equivalences.json`

Incremental table — never cleared, only appended. Stores only `llm` and `unresolved` outcomes.

```json
{
  "lastSync": "2026-06-07T14:23:11.000Z",
  "entries": {
    "<piProvider>|<piId>": {
      "modelsDevProvider": "anthropic" | null,
      "modelsDevId": "claude-opus-4-5" | null,
      "resolvedVia": "llm" | "unresolved",
      "resolvedAt": "2026-06-07T14:23:11.000Z"
    }
  }
}
```

### `logos/<provider>.png`

Rasterized 32×32 PNG, generated once via `rsvg-convert`. If a provider has no logo on models.dev (404), an empty `logos/<provider>.no-logo` marker is written so we never re-attempt.

## TTL & refresh policy

On `session_start`:

1. Read `catalog.json`.
2. If absent → `await fetchCatalog()` (blocks ~500ms, one-time per machine).
3. If present and `Date.now() - lastSync < 24h` → use as-is, no fetch.
4. If present and stale (≥24h):
   - Use the stale catalog immediately for the initial render (no blocking).
   - Schedule a background refresh via `setImmediate(() => fetchCatalog().then(saveAndRerender))`.
   - On success, overwrite `catalog.json` and re-call `renderWidget` (only if active model's meta changed; trivial deep-equality check on the resolved meta object).

If `fetchCatalog()` fails (no network, 5xx, timeout): silently keep using the previous catalog (if any). Never crash, never block the session.

If `catalog.json` is absent AND fetch fails: render degraded mode `[?] <id> · <provider>`.

## Render

The widget is registered as a factory function (not a string array) to be able to embed the `Image` component:

```ts
ctx.ui.setWidget(
  "model-meta",
  (tui, theme) => buildWidget(meta, logoPngBase64, theme),
  { placement: "belowEditor" }
);
```

### Visual layout (target)

```
🎀 Claude Opus 4.7 · google-vertex-anthropic · $5/$25 · ctx 1M / out 128k
🖼️ 📄 🧠 🔧 image · pdf · reasoning · tools · knowledge 2026-01
```

Where `🎀` is replaced by the actual rendered logo image (1 cell high × 2 cells wide via Kitty graphics in Ghostty/Kitty terminals, automatic fallback in others).

### Line 1 components (left to right)

- Logo `Image` (or emoji fallback) — `maxHeightCells: 1, maxWidthCells: 2`
- Space
- Model `name` from api.json (NOT the raw id — `name` is human-readable)
- ` · ` separator
- Provider id (pi side, since that's what user configured)
- ` · ` separator
- Price: `$<input>/$<output>` (per 1M tokens, integers when whole, 2 decimals otherwise)
- ` · ` separator
- `ctx <ctxFormatted> / out <outFormatted>` where formatted is `1M`, `200k`, `128k`, etc.

### Line 2 components

- Icons grouped: 🖼️ (if `attachment` AND `modalities.input.includes("image")`), 📄 (if `modalities.input.includes("pdf")`), 🧠 (if `reasoning`), 🔧 (if `tool_call`)
- Space
- Text labels mirroring the icons (`image · pdf · reasoning · tools`)
- ` · ` separator
- `knowledge <YYYY-MM>` (if `knowledge` field present)

### Degraded render

When no models.dev metadata available:

```
[?] claude-opus-4-7@default · google-vertex-anthropic
(model not found in models.dev catalog)
```

Line 2 stays as a single muted line. No icons, no price.

### Container layout caveat

**UNVERIFIED:** The exact API of `pi-tui`'s `Container` for horizontal layouts (logo + text side-by-side) needs verification when implementing `render/widget.ts`. If horizontal layout proves awkward:

- **Fallback A:** Render logo as line 0 by itself (1 cell wide), text starts on line 1. Widget grows to 3 lines.
- **Fallback B:** Skip the inline Image and use the emoji from `PROVIDER_EMOJI` map. Keeps 2 lines but no real logo.

Decision deferred to implementation time after reading `pi-tui/dist/components/container.d.ts` and `pi-tui/dist/tui.d.ts`.

## Logo pipeline

### Download

`https://models.dev/logos/${provider}.svg` (note: `${provider}` is the **models.dev** provider id resolved by the cascade, not the pi provider — falls back to pi provider if cascade returned `unresolved`).

- 404 → write `logos/<provider>.no-logo`, never retry.
- Network failure → don't write marker, try again next time.
- Success → write `logos/<provider>.svg` (cache the source too, for re-rasterization).

### Rasterize

If `command -v rsvg-convert` succeeds:

```bash
rsvg-convert --width=32 --height=32 logos/<provider>.svg > logos/<provider>.png
```

If `rsvg-convert` is absent:

- On first failure across the lifetime of the cache, call `ctx.ui.notify("Install librsvg for provider logos: brew install librsvg", "info")` ONCE. Track via `~/.pi/cache/model-meta/.notified-rsvg` marker.
- Use emoji from `PROVIDER_EMOJI` map. Mapping:

```ts
const PROVIDER_EMOJI: Record<string, string> = {
  anthropic: "🎀",
  "google-vertex-anthropic": "🎀",
  openai: "⚫",
  google: "🔷",
  xai: "✨",
  meta: "🔵",
  mistral: "🟠",
  // default fallback: "🔌"
};
```

### Runtime usage

```ts
const pngBuf = fs.readFileSync(logoPath);
const b64 = pngBuf.toString("base64");
const img = new Image(
  b64,
  "image/png",
  { fallbackColor: (s) => theme.fg("dim", s) },
  { maxHeightCells: 1, maxWidthCells: 2 }
);
```

pi-tui handles terminal capability detection automatically (`detectCapabilities()` is internal). In Ghostty/Kitty the Kitty graphics protocol is used. In iTerm2, the iTerm2 inline protocol. Elsewhere, `imageFallback` renders a colored block.

## Error handling

| Scenario | Behavior |
|---|---|
| No network on first startup | Degraded render `[?] <id> · <provider>`. Retry next session_start. |
| `api.json` malformed | Log to stderr, keep previous catalog if any, render degraded. |
| `equivalences.json` corrupt | Rename to `equivalences.json.bak`, start fresh, never crash. |
| LLM call fails / times out | Record `unresolved`, render degraded. Don't retry until cache rebuild. |
| `rsvg-convert` missing | One-time notify, use emoji fallback. |
| `Image` component fails to render | pi-tui's internal fallback (colored block). |
| Active model has no `ctx.model` (e.g., no provider configured) | Don't render widget at all (`setWidget("model-meta", undefined)`). |
| Provider/model removed from api.json upstream | Direct lookup fails → falls through to heuristic / cache / llm. Cached `direct` entries are not used (we don't cache `direct`). |

## What this extension explicitly does NOT do

- Does NOT register any flag (no `flag:registered` emit).
- Does NOT register any tool.
- Does NOT register any command (no `/model-meta`).
- Does NOT modify `tool_call`, `tool_result`, `before_agent_start`, `context`, `before_provider_request`, or any other interception event.
- Does NOT change pi's behavior. It is read-only on `ctx.model` and write-only on `ctx.ui.setWidget`.

## Token budget

- **Steady state:** 0 tokens. Everything resolved via cache.
- **First time seeing an unknown model:** ~200 input + ~30 output tokens (one LLM call to resolve).
- **Catalog refresh:** 0 tokens. Pure HTTP fetch.

## Open questions for implementation

1. Exact API of `pi-tui` `Container` for horizontal layout (see Render section caveat).
2. Whether `ctx.modelRegistry.getApiKeyAndHeaders(ctx.model)` works in all contexts where `resolve/llm.ts` runs (it might need an active model AND auth — verify by reading the `context-compact` extension which uses the same pattern).
3. Whether `model_select` fires during `session_start` (with `source: "restore"`) — if so, the `session_start` handler should NOT re-render to avoid double-rendering. Solution: guard with a "lastRenderedKey" check `${provider}|${id}`.
