# model-meta Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **File contract driven agent development:** Each file in this plan has a frozen public contract (exported types, functions, signatures, side-effects). Subagents can develop in parallel by mocking sibling contracts. Do NOT change contracts mid-flight — if a contract is wrong, stop, fix it here, then resume.

**Goal:** Build a pi.dev extension that renders a 3-line widget below the editor showing the active model's metadata (name, provider, price, capabilities, context limits, knowledge cutoff, logo) sourced from models.dev.

**Architecture:** Single extension at `~/.config/pi/agent/extensions/model-meta/` with no `package.json` and no `node_modules/` — all imports resolve from pi's runtime. The extension subscribes to `session_start`, `model_select`, and `session_shutdown`. A resolution cascade (direct → heuristic → cache → LLM fallback) maps pi model IDs to models.dev entries. A logo pipeline downloads SVGs from models.dev and rasterizes them to PNG with `rsvg-convert` (graceful emoji fallback when missing). All artifacts cached under `~/.pi/cache/model-meta/` (resolves to `~/.config/pi/cache/model-meta/` via existing symlink).

**Tech Stack:** TypeScript, `@earendil-works/pi-coding-agent` (events + ExtensionAPI), `@earendil-works/pi-tui` (Image, Text, Container), `@earendil-works/pi-ai` (`complete()` for LLM fallback), Node built-ins (`node:fs`, `node:path`, `node:https`, `node:child_process`, `node:crypto`). No npm dependencies.

**Decisions locked in from brainstorming:**

1. **Layout = Fallback A** — Widget is **3 lines**, not 2. Line 0 = logo PNG via `Image` (height 1 cell, width 2 cells). Line 1 = name · provider · price · ctx/out. Line 2 = capability icons + labels + knowledge.
2. **Logo "missing" detection = NONE** — models.dev returns HTTP 200 with a placeholder sparkle SVG for unknown providers (not 404 as spec assumed). We always render whatever the server returns. No `.no-logo` marker file. This simplifies `logo/download.ts` and removes a whole branch from the rasterize/render flow.
3. **Family search tiebreaker = release_date DESC + lexical similarity** — When multiple models match by `family` prefix, sort first by `release_date` descending (most recent wins), then by longest common prefix length with the pi id descending. First entry wins. Deterministic and "newest equivalent" intuitive.
4. **No package.json** — Single-directory extension, no `bun install`, no `node_modules/`. All imports from pi runtime. (Spec ratified.)

**Out of scope (re-confirmed from spec):** No `/model-meta` commands, no flag/tool/shortcut registration, no LLM behavior modification, no telemetry, no manual equivalence editor.

---

## File Structure & Contracts

Each file is ≤120 LOC (target ≤70). Contracts here are FROZEN — implementations must match exactly.

### `types.ts`

Public types shared across files. Pure type module, no runtime code.

```ts
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
```

### `lib/paths.ts`

Path helpers for `~/.pi/cache/model-meta/`. Pure synchronous filesystem path builders + `ensureDir`.

```ts
export const CACHE_ROOT: string;              // `${os.homedir()}/.pi/cache/model-meta`
export function catalogPath(): string;        // `${CACHE_ROOT}/catalog.json`
export function equivalencesPath(): string;   // `${CACHE_ROOT}/equivalences.json`
export function logosDir(): string;           // `${CACHE_ROOT}/logos`
export function logoSvgPath(provider: string): string;   // `${logosDir()}/${provider}.svg`
export function logoPngPath(provider: string): string;   // `${logosDir()}/${provider}.png`
export function notifiedRsvgMarker(): string; // `${CACHE_ROOT}/.notified-rsvg`
export function ensureCacheDirs(): void;      // mkdir -p CACHE_ROOT and logosDir, idempotent
```

### `catalog/fetch.ts`

HTTPS fetch of models.dev api.json. No retries, no timeout config beyond a hard 10s.

```ts
import type { CatalogData } from "../types";

/** GET https://models.dev/api.json with 10s timeout. Throws on non-2xx, network error, or parse error. */
export async function fetchCatalog(): Promise<CatalogData>;
```

### `catalog/store.ts`

Read/write `catalog.json`. Atomic write via tmp + rename. Read returns `null` if absent or corrupt (no throws; caller decides).

```ts
import type { CatalogFile } from "../types";

export function readCatalog(): CatalogFile | null;
export function writeCatalog(file: CatalogFile): void;
```

### `catalog/refresh.ts`

TTL policy. Orchestrates fetch + write + change-detection callback. Pure async, no UI calls.

```ts
import type { CatalogData } from "../types";

export const TTL_MS = 24 * 60 * 60 * 1000;

/** True if a stored catalog is older than TTL_MS (or absent). */
export function isStale(lastSync: string | null): boolean;

/** Fetch + persist. Returns the fresh data, or throws on failure. */
export async function refreshCatalog(): Promise<CatalogData>;
```

### `resolve/direct.ts`

Direct lookup in api.json.

```ts
import type { CatalogData, CatalogModel } from "../types";

export interface DirectHit {
  provider: string;
  id: string;
  model: CatalogModel;
}

export function directLookup(catalog: CatalogData, provider: string, id: string): DirectHit | null;
```

### `resolve/heuristic.ts`

Deterministic transforms + family search. All rules in one place.

```ts
import type { CatalogData } from "../types";
import type { DirectHit } from "./direct";

/** Hardcoded pi-provider -> models.dev provider aliases. */
export const PROVIDER_ALIASES: Record<string, string[]>;
// e.g. { "google-vertex-anthropic": ["anthropic"] }

/**
 * Apply rules 1-5 in order, first hit wins.
 * Rules:
 *   1. Strip "@suffix" (e.g. "@default") and retry direct.
 *   2. Strip date suffix "-YYYYMMDD" and retry direct.
 *   3. Lowercase and retry direct.
 *   4. For each alias in PROVIDER_ALIASES[provider], retry direct with each candidate id.
 *   5. Family search: scan provider's models for entries whose `family` is a prefix of the
 *      transformed id; sort matches by release_date DESC, then by length of longest common
 *      prefix with the pi id DESC; return the first.
 */
export function heuristicLookup(catalog: CatalogData, provider: string, id: string): DirectHit | null;
```

### `resolve/llm.ts`

LLM fallback using `complete()` from `@earendil-works/pi-ai`. Single call, strict JSON parse, no retries.

```ts
import type { Model } from "@earendil-works/pi-ai";
import type { CatalogData } from "../types";

export interface LlmResult {
  modelsDevProvider: string | null;
  modelsDevId: string | null;
}

/**
 * Ask the active model to map a pi (provider, id) pair to a models.dev (provider, id) pair.
 * Returns { null, null } if no candidate matches, the call fails, or parsing fails.
 * `auth` must be the result of `ctx.modelRegistry.getApiKeyAndHeaders(model)`.
 */
export async function llmResolve(args: {
  catalog: CatalogData;
  piProvider: string;
  piId: string;
  activeModel: Model<any>;
  apiKey: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<LlmResult>;
```

### `resolve/cascade.ts`

Orchestrator. Glues direct → heuristic → cache → llm. Reads/writes equivalences file.

```ts
import type { Model } from "@earendil-works/pi-ai";
import type { CatalogData, EquivalencesFile, ModelMeta } from "../types";

/** Pure read of equivalences.json. Returns empty struct on missing/corrupt (renames .bak). */
export function loadEquivalences(): EquivalencesFile;

/** Atomic write. */
export function saveEquivalences(file: EquivalencesFile): void;

export async function resolveModel(args: {
  catalog: CatalogData;
  piProvider: string;
  piId: string;
  activeModel: Model<any> | undefined;
  authProvider?: {
    getApiKeyAndHeaders(model: Model<any>): Promise<{
      ok: boolean;
      apiKey?: string;
      headers?: Record<string, string>;
    }>;
  };
  signal?: AbortSignal;
}): Promise<ModelMeta>;
```

### `logo/download.ts`

Fetch `/logos/<provider>.svg` and cache to disk. Always treats HTTP 200 as success (per Decision 2).

```ts
/**
 * Download the logo SVG and save it to disk. Returns the on-disk path on success,
 * or null on network failure / non-2xx.
 * Idempotent: if the file already exists, returns its path without re-fetching.
 */
export async function ensureLogoSvg(modelsDevProvider: string): Promise<string | null>;
```

### `logo/rasterize.ts`

Convert SVG → PNG via `rsvg-convert`. Returns base64 PNG or null. Handles missing binary with one-time notify.

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Rasterize an SVG file to 32x32 PNG. Returns base64 PNG on success, null otherwise.
 * On first failure due to missing `rsvg-convert`, calls ctx.ui.notify exactly once
 * (tracked via marker file).
 * Idempotent: cached PNG is reused.
 */
export async function rasterizeLogo(svgPath: string, modelsDevProvider: string, ctx: ExtensionContext): Promise<string | null>;
```

### `render/icons.ts`

Static capability → emoji map and provider → emoji map.

```ts
export interface CapabilityIcons {
  image: string;
  pdf: string;
  reasoning: string;
  tools: string;
}

export const CAPABILITY_ICONS: CapabilityIcons; // { image: "🖼️", pdf: "📄", reasoning: "🧠", tools: "🔧" }
export const PROVIDER_EMOJI: Record<string, string>; // anthropic: "🎀", openai: "⚫", ... default "🔌"

export function providerEmoji(providerId: string): string;
```

### `render/format.ts`

Pure string formatters.

```ts
import type { CatalogModel } from "../types";

/** "$5" or "$3.50" given cost per 1M tokens. */
export function formatPrice(value: number | undefined): string;

/** Format a context/output limit as "1M", "200k", "128k", etc. */
export function formatTokenLimit(n: number | undefined): string;

/** Return active capability icons (in order: image, pdf, reasoning, tools). */
export function activeIcons(model: CatalogModel): string[];

/** Same set as activeIcons but as text labels: ["image", "pdf", "reasoning", "tools"]. */
export function activeLabels(model: CatalogModel): string[];

/** Return "knowledge YYYY-MM" or "" if missing. */
export function formatKnowledge(model: CatalogModel): string;
```

### `render/widget.ts`

Build the `Container` factory passed to `setWidget`. Per Decision 1, layout is 3 stacked lines:

- Line 0: `Image` (logo, height 1 cell, width 2 cells) — or `Text` emoji if base64 missing.
- Line 1: `Text` with name · provider · price · ctx/out.
- Line 2: `Text` with icons + labels + knowledge.

Degraded path: a single 2-line `Text` block with `[?] <id> · <provider>` and a muted note.

```ts
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

export function buildWidgetFactory(meta: ModelMeta, logoPngBase64: string | null): WidgetFactory;
```

### `index.ts`

Wiring. Subscribes to `session_start`, `model_select`, `session_shutdown`. Holds the in-memory catalog and a `lastRenderedKey` guard to avoid double-render on session restore.

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI): void;
```

---

## Task Plan

Tasks are grouped in waves. Waves can run in parallel; within a wave, tasks are independent because every dependency is mocked against the FROZEN contracts above. Each task ends with a commit.

> **Branch:** Create `feat/model-meta-extension` once before Task 1, work on it for every task, do NOT use git worktrees.

---

### Task 0: Scaffold extension directory and types

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/types.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/lib/paths.ts`

- [ ] **Step 1: Create branch**

```bash
git -C ~/.config/pi checkout -b feat/model-meta-extension
```

- [ ] **Step 2: Create extension directory**

```bash
mkdir -p ~/.config/pi/agent/extensions/model-meta/{catalog,resolve,render,logo,lib}
```

- [ ] **Step 3: Write `types.ts`**

Copy the exact types listed in the `types.ts` contract above. No additional fields, no defaults, no runtime code.

- [ ] **Step 4: Write `lib/paths.ts`**

```ts
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

export const CACHE_ROOT = path.join(os.homedir(), ".pi", "cache", "model-meta");
export const catalogPath = () => path.join(CACHE_ROOT, "catalog.json");
export const equivalencesPath = () => path.join(CACHE_ROOT, "equivalences.json");
export const logosDir = () => path.join(CACHE_ROOT, "logos");
export const logoSvgPath = (p: string) => path.join(logosDir(), `${p}.svg`);
export const logoPngPath = (p: string) => path.join(logosDir(), `${p}.png`);
export const notifiedRsvgMarker = () => path.join(CACHE_ROOT, ".notified-rsvg");

export function ensureCacheDirs(): void {
  fs.mkdirSync(logosDir(), { recursive: true });
}
```

- [ ] **Step 5: Verify TypeScript parses**

```bash
cd ~/.config/pi/agent/extensions/model-meta && npx -y tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --strict types.ts lib/paths.ts 2>&1 | head -20
```

Expected: no errors. (`tsc` may warn about missing `@types/node` since this extension has no `node_modules`; that's OK — pi loads via `jiti` which resolves at runtime. Only structural errors count as failures.)

- [ ] **Step 6: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/types.ts agent/extensions/model-meta/lib/paths.ts
git -C ~/.config/pi commit -m "feat(model-meta): scaffold extension directory, types, and path helpers"
```

---

### Task 1: Catalog fetch + store + refresh (Wave A)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/catalog/fetch.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/catalog/store.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/catalog/refresh.ts`

- [ ] **Step 1: Write `catalog/fetch.ts`**

```ts
import * as https from "node:https";
import type { CatalogData } from "../types";

export async function fetchCatalog(): Promise<CatalogData> {
  return new Promise((resolve, reject) => {
    const req = https.get("https://models.dev/api.json", { timeout: 10_000 }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`models.dev returned HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(parsed as CatalogData);
        } catch (err) {
          reject(new Error(`models.dev parse error: ${(err as Error).message}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("models.dev fetch timeout")); });
  });
}
```

- [ ] **Step 2: Write `catalog/store.ts`**

```ts
import * as fs from "node:fs";
import type { CatalogFile } from "../types";
import { catalogPath, ensureCacheDirs } from "../lib/paths";

export function readCatalog(): CatalogFile | null {
  try {
    const raw = fs.readFileSync(catalogPath(), "utf8");
    const parsed = JSON.parse(raw) as CatalogFile;
    if (!parsed || typeof parsed.lastSync !== "string" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCatalog(file: CatalogFile): void {
  ensureCacheDirs();
  const tmp = `${catalogPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file));
  fs.renameSync(tmp, catalogPath());
}
```

- [ ] **Step 3: Write `catalog/refresh.ts`**

```ts
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
```

- [ ] **Step 4: Smoke-test fetch + persistence (out-of-process)**

```bash
node --input-type=module -e "
import('node:fs').then(async fs => {
  const { fetchCatalog } = await import('/Users/hugoruiz/.config/pi/agent/extensions/model-meta/catalog/fetch.ts');
  const d = await fetchCatalog();
  console.log('providers:', Object.keys(d).length);
});
" 2>&1 | head -5
```

Expected: a number ≥ 30 (current count of providers in models.dev). If this fails due to missing TS runtime in node, skip this step — the extension will load via `jiti` at pi startup which handles `.ts` natively.

- [ ] **Step 5: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/catalog/
git -C ~/.config/pi commit -m "feat(model-meta): add catalog fetch, store, and TTL refresh"
```

---

### Task 2: Resolution — direct + heuristic (Wave A, parallel with Task 1)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/resolve/direct.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/resolve/heuristic.ts`

- [ ] **Step 1: Write `resolve/direct.ts`**

```ts
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
```

- [ ] **Step 2: Write `resolve/heuristic.ts`**

```ts
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
```

- [ ] **Step 3: Inline manual test (interactive verification, not committed)**

Run mentally / via `node` REPL with the live api.json: feed `("google-vertex-anthropic", "claude-opus-4-7@default")` and assert hit is `anthropic` with the most-recent `claude-opus-*` model (today: `claude-opus-4-8`). If wrong, fix `commonPrefixLen` or family sort before continuing.

- [ ] **Step 4: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/resolve/direct.ts agent/extensions/model-meta/resolve/heuristic.ts
git -C ~/.config/pi commit -m "feat(model-meta): add direct + heuristic resolution cascade"
```

---

### Task 3: Logo download + rasterize (Wave A, parallel with Tasks 1-2)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/logo/download.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/logo/rasterize.ts`

- [ ] **Step 1: Write `logo/download.ts`**

```ts
import * as fs from "node:fs";
import * as https from "node:https";
import { ensureCacheDirs, logoSvgPath } from "../lib/paths";

export async function ensureLogoSvg(modelsDevProvider: string): Promise<string | null> {
  ensureCacheDirs();
  const target = logoSvgPath(modelsDevProvider);
  if (fs.existsSync(target)) return target;

  return new Promise((resolve) => {
    const url = `https://models.dev/logos/${encodeURIComponent(modelsDevProvider)}.svg`;
    const req = https.get(url, { timeout: 10_000 }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const tmp = `${target}.tmp`;
          fs.writeFileSync(tmp, Buffer.concat(chunks));
          fs.renameSync(tmp, target);
          resolve(target);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}
```

- [ ] **Step 2: Write `logo/rasterize.ts`**

```ts
import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { logoPngPath, notifiedRsvgMarker } from "../lib/paths";

function rsvgAvailable(): boolean {
  const r = spawnSync("rsvg-convert", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function notifyOnce(ctx: ExtensionContext): void {
  try {
    if (fs.existsSync(notifiedRsvgMarker())) return;
    ctx.ui.notify("Install librsvg for provider logos: brew install librsvg", "info");
    fs.writeFileSync(notifiedRsvgMarker(), "");
  } catch {
    /* ignore */
  }
}

export async function rasterizeLogo(svgPath: string, modelsDevProvider: string, ctx: ExtensionContext): Promise<string | null> {
  const out = logoPngPath(modelsDevProvider);
  if (fs.existsSync(out)) return out;
  if (!rsvgAvailable()) {
    notifyOnce(ctx);
    return null;
  }
  const r = spawnSync("rsvg-convert", ["--width=32", "--height=32", "--output", out, svgPath], { stdio: "ignore" });
  return r.status === 0 && fs.existsSync(out) ? out : null;
}
```

- [ ] **Step 3: Manual smoke test (run, do not commit)**

```bash
cd /tmp && cat > test-logo.mjs <<'EOF'
import { spawnSync } from "node:child_process";
spawnSync("curl", ["-sfo", "/tmp/anthropic.svg", "https://models.dev/logos/anthropic.svg"]);
const r = spawnSync("rsvg-convert", ["--width=32", "--height=32", "--output", "/tmp/anthropic.png", "/tmp/anthropic.svg"]);
console.log("rsvg status:", r.status, "size:", spawnSync("wc", ["-c", "/tmp/anthropic.png"]).stdout.toString());
EOF
node test-logo.mjs
```

Expected: `rsvg status: 0` and a PNG file size > 0. If rsvg-convert is missing, status will be non-zero and `notifyOnce` would trigger in-extension.

- [ ] **Step 4: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/logo/
git -C ~/.config/pi commit -m "feat(model-meta): add logo download and rsvg rasterize pipeline"
```

---

### Task 4: Render formatters + icons (Wave A, parallel)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/render/icons.ts`
- Create: `~/.config/pi/agent/extensions/model-meta/render/format.ts`

- [ ] **Step 1: Write `render/icons.ts`**

```ts
export interface CapabilityIcons {
  image: string;
  pdf: string;
  reasoning: string;
  tools: string;
}

export const CAPABILITY_ICONS: CapabilityIcons = {
  image: "🖼️",
  pdf: "📄",
  reasoning: "🧠",
  tools: "🔧",
};

export const PROVIDER_EMOJI: Record<string, string> = {
  anthropic: "🎀",
  "google-vertex-anthropic": "🎀",
  "amazon-bedrock-anthropic": "🎀",
  openai: "⚫",
  google: "🔷",
  "google-vertex": "🔷",
  xai: "✨",
  meta: "🔵",
  mistral: "🟠",
};

export function providerEmoji(providerId: string): string {
  return PROVIDER_EMOJI[providerId] ?? "🔌";
}
```

- [ ] **Step 2: Write `render/format.ts`**

```ts
import type { CatalogModel } from "../types";
import { CAPABILITY_ICONS } from "./icons";

export function formatPrice(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "?";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function formatTokenLimit(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "?";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function hasImage(m: CatalogModel): boolean {
  return Boolean(m.attachment) && Array.isArray(m.modalities?.input) && (m.modalities!.input as string[]).includes("image");
}
function hasPdf(m: CatalogModel): boolean {
  return Array.isArray(m.modalities?.input) && (m.modalities!.input as string[]).includes("pdf");
}

export function activeIcons(model: CatalogModel): string[] {
  const out: string[] = [];
  if (hasImage(model)) out.push(CAPABILITY_ICONS.image);
  if (hasPdf(model)) out.push(CAPABILITY_ICONS.pdf);
  if (model.reasoning) out.push(CAPABILITY_ICONS.reasoning);
  if (model.tool_call) out.push(CAPABILITY_ICONS.tools);
  return out;
}

export function activeLabels(model: CatalogModel): string[] {
  const out: string[] = [];
  if (hasImage(model)) out.push("image");
  if (hasPdf(model)) out.push("pdf");
  if (model.reasoning) out.push("reasoning");
  if (model.tool_call) out.push("tools");
  return out;
}

export function formatKnowledge(model: CatalogModel): string {
  return model.knowledge ? `knowledge ${model.knowledge}` : "";
}
```

- [ ] **Step 3: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/render/
git -C ~/.config/pi commit -m "feat(model-meta): add render formatters and icon maps"
```

---

### Task 5: LLM fallback (Wave B, depends on Task 0 only — runs parallel with all of Wave A)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/resolve/llm.ts`

- [ ] **Step 1: Write `resolve/llm.ts`**

```ts
import { complete, type Model } from "@earendil-works/pi-ai";
import type { CatalogData } from "../types";

export interface LlmResult {
  modelsDevProvider: string | null;
  modelsDevId: string | null;
}

function buildPrompt(piProvider: string, piId: string, guessedProvider: string, candidateIds: string[]): string {
  return `You are matching a pi.dev model ID to a models.dev entry.

pi model:
  provider: ${piProvider}
  id: ${piId}

models.dev candidates from provider "${guessedProvider}":
${candidateIds.join("\n")}

Return ONLY a single JSON object:
{ "modelsDevProvider": "<string>", "modelsDevId": "<string|null>" }

If no candidate matches, return { "modelsDevProvider": null, "modelsDevId": null }.`;
}

function parseLlmJson(text: string): LlmResult {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { modelsDevProvider: null, modelsDevId: null };
    const parsed = JSON.parse(m[0]);
    const provider = typeof parsed.modelsDevProvider === "string" ? parsed.modelsDevProvider : null;
    const id = typeof parsed.modelsDevId === "string" ? parsed.modelsDevId : null;
    return { modelsDevProvider: provider, modelsDevId: id };
  } catch {
    return { modelsDevProvider: null, modelsDevId: null };
  }
}

export async function llmResolve(args: {
  catalog: CatalogData;
  piProvider: string;
  piId: string;
  activeModel: Model<any>;
  apiKey: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<LlmResult> {
  const guessedProvider = args.catalog[args.piProvider] ? args.piProvider : args.piProvider;
  const candidates = args.catalog[guessedProvider] ? Object.keys(args.catalog[guessedProvider].models) : [];
  if (candidates.length === 0) return { modelsDevProvider: null, modelsDevId: null };

  const prompt = buildPrompt(args.piProvider, args.piId, guessedProvider, candidates);
  try {
    const response = await complete(
      args.activeModel,
      {
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        }],
      },
      { apiKey: args.apiKey, headers: args.headers, maxTokens: 256, signal: args.signal },
    );
    const text = response.content
      .filter((c: any): c is { type: "text"; text: string } => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return parseLlmJson(text);
  } catch {
    return { modelsDevProvider: null, modelsDevId: null };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/resolve/llm.ts
git -C ~/.config/pi commit -m "feat(model-meta): add LLM fallback for orphan model IDs"
```

---

### Task 6: Resolution cascade orchestrator (Wave C, depends on Tasks 0, 2, 5)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/resolve/cascade.ts`

- [ ] **Step 1: Write `resolve/cascade.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/resolve/cascade.ts
git -C ~/.config/pi commit -m "feat(model-meta): add resolution cascade with equivalence persistence"
```

---

### Task 7: Widget factory (Wave C, depends on Tasks 0, 4)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/render/widget.ts`

- [ ] **Step 1: Write `render/widget.ts`**

```ts
import { Container, Image, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelMeta } from "../types";
import { activeIcons, activeLabels, formatKnowledge, formatPrice, formatTokenLimit } from "./format";
import { providerEmoji } from "./icons";

export type WidgetFactory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

function buildLine1(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  const price = `${formatPrice(m.cost?.input)}/${formatPrice(m.cost?.output)}`;
  const ctx = `ctx ${formatTokenLimit(m.limit?.context)} / out ${formatTokenLimit(m.limit?.output)}`;
  return `${m.name} · ${meta.piProvider} · ${price} · ${ctx}`;
}

function buildLine2(meta: ModelMeta): string {
  if (!meta.ok || !meta.model) return "";
  const m = meta.model;
  const icons = activeIcons(m).join(" ");
  const labels = activeLabels(m).join(" · ");
  const knowledge = formatKnowledge(m);
  const parts = [icons, labels].filter(Boolean);
  if (knowledge) parts.push(knowledge);
  return parts.join(" · ");
}

export function buildWidgetFactory(meta: ModelMeta, logoPngBase64: string | null): WidgetFactory {
  return (_tui, theme) => {
    const container = new Container();

    if (!meta.ok) {
      const line1 = `[?] ${meta.piId} · ${meta.piProvider}`;
      const line2 = "(model not found in models.dev catalog)";
      container.addChild(new Text(line1));
      container.addChild(new Text(theme.fg("dim", line2)));
      return container;
    }

    // Line 0: logo
    if (logoPngBase64) {
      const img = new Image(
        logoPngBase64,
        "image/png",
        { fallbackColor: (s: string) => theme.fg("dim", s) },
        { maxHeightCells: 1, maxWidthCells: 2 },
      );
      container.addChild(img);
    } else {
      container.addChild(new Text(providerEmoji(meta.piProvider)));
    }

    // Line 1, Line 2
    container.addChild(new Text(buildLine1(meta)));
    container.addChild(new Text(buildLine2(meta)));
    return container;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/render/widget.ts
git -C ~/.config/pi commit -m "feat(model-meta): add 3-line widget factory (Fallback A layout)"
```

---

### Task 8: Wiring — index.ts (Wave D, depends on Tasks 1, 3, 6, 7)

**Files:**
- Create: `~/.config/pi/agent/extensions/model-meta/index.ts`

- [ ] **Step 1: Write `index.ts`**

```ts
import * as fs from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CatalogData, ModelMeta } from "./types";
import { readCatalog, writeCatalog } from "./catalog/store";
import { isStale, refreshCatalog } from "./catalog/refresh";
import { resolveModel } from "./resolve/cascade";
import { ensureLogoSvg } from "./logo/download";
import { rasterizeLogo } from "./logo/rasterize";
import { buildWidgetFactory } from "./render/widget";
import { logoPngPath } from "./lib/paths";

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
        // background refresh
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

  async function loadLogoBase64(modelsDevProvider: string | null, ctx: ExtensionContext): Promise<string | null> {
    if (!modelsDevProvider) return null;
    const pngPath = logoPngPath(modelsDevProvider);
    if (!fs.existsSync(pngPath)) {
      const svgPath = await ensureLogoSvg(modelsDevProvider);
      if (!svgPath) return null;
      const rasterized = await rasterizeLogo(svgPath, modelsDevProvider, ctx);
      if (!rasterized) return null;
    }
    try {
      return fs.readFileSync(logoPngPath(modelsDevProvider)).toString("base64");
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

    const logoBase64 = await loadLogoBase64(meta.modelsDevProvider ?? meta.piProvider, ctx);
    ctx.ui.setWidget(WIDGET_KEY, buildWidgetFactory(meta, logoBase64), { placement: "belowEditor" });
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
```

- [ ] **Step 2: Reload pi and verify the widget renders**

In an interactive pi session, run `/reload`. Expected: widget appears below the editor showing the active model's metadata (or `[?] ...` degraded form if resolution fails). Cycle the model with `Ctrl+P` and confirm the widget updates.

- [ ] **Step 3: Commit**

```bash
git -C ~/.config/pi add agent/extensions/model-meta/index.ts
git -C ~/.config/pi commit -m "feat(model-meta): wire extension lifecycle (session_start, model_select, shutdown)"
```

---

### Task 9: Manual verification + final commit

- [ ] **Step 1: Verify cache files were created**

```bash
ls -la ~/.config/pi/cache/model-meta/ 2>&1
```

Expected: `catalog.json` (a few MB), `logos/` with at least one `.svg` and `.png` for the active model's provider.

- [ ] **Step 2: Verify orphan resolution path persists**

If the active model is unknown (e.g. `claude-opus-4-7@default` is past catalog tip), inspect:

```bash
cat ~/.config/pi/cache/model-meta/equivalences.json 2>&1 | python3 -m json.tool | head -20
```

Expected: at most one `entries` key written ONLY if the LLM fallback was invoked (heuristic miss). If heuristic catches it via family search, no entry is written — that's intentional.

- [ ] **Step 3: Verify widget on terminals without rsvg-convert (optional, do not skip if rsvg is present)**

```bash
# Temporarily hide rsvg from PATH and reload pi (in a scratch shell)
PATH=$(echo $PATH | tr ':' '\n' | grep -v rsvg | paste -sd: -) pi
```

Expected: emoji fallback appears in line 0, a one-time notify telling the user to install librsvg, marker `.notified-rsvg` written under cache dir.

- [ ] **Step 4: Confirm degraded render when offline**

Block network briefly and reload pi with a fresh cache (`mv ~/.config/pi/cache/model-meta ~/.config/pi/cache/model-meta.bak`). Expected: `[?] <id> · <provider>` rendered, no crash, no infinite spinner.

- [ ] **Step 5: Push branch (do NOT merge until user reviews)**

```bash
git -C ~/.config/pi push -u origin feat/model-meta-extension
```

(Skip if no git remote is configured for `~/.config/pi`.)

---

## Wave Diagram (for parallel execution)

```
       ┌──────────────┐
       │ Task 0       │   types + paths
       │ (scaffold)   │
       └──────┬───────┘
              │
   ┌──────────┼──────────┬─────────────┐
   │          │          │             │
┌──▼───┐  ┌──▼───┐   ┌──▼───┐     ┌───▼───┐
│Task 1│  │Task 2│   │Task 3│     │Task 4 │  Wave A (parallel)
│catalg│  │direct│   │logo  │     │render │
│      │  │heur. │   │      │     │fmts   │
└──┬───┘  └──┬───┘   └──┬───┘     └───┬───┘
   │         │          │             │
   │     ┌───▼───┐      │             │
   │     │Task 5 │      │             │   Wave B (depends on Task 0)
   │     │llm    │      │             │
   │     └───┬───┘      │             │
   │         │          │             │
   │    ┌────▼─────┐    │     ┌───────▼───┐
   │    │ Task 6   │    │     │ Task 7    │  Wave C
   │    │ cascade  │    │     │ widget    │
   │    └────┬─────┘    │     └─────┬─────┘
   │         │          │           │
   └─────────┴──────────┴───────────┴─────► Task 8 (index.ts)
                                            │
                                            ▼
                                          Task 9 (verify + push)
```

---

## File Contract Summary (for parallel agents)

Each agent gets ONE task. The contract every other agent honors is the exports listed in the "File Structure & Contracts" section above. Do not add fields. Do not change function signatures. If your task discovers a contract bug, STOP, post it back, do not silently widen the contract.

| File | Public exports | Side effects |
|---|---|---|
| `types.ts` | `CatalogModel`, `CatalogProvider`, `CatalogData`, `CatalogFile`, `EquivalenceEntry`, `EquivalencesFile`, `ModelMeta` | none |
| `lib/paths.ts` | `CACHE_ROOT`, `catalogPath`, `equivalencesPath`, `logosDir`, `logoSvgPath`, `logoPngPath`, `notifiedRsvgMarker`, `ensureCacheDirs` | `mkdirSync` on `ensureCacheDirs` |
| `catalog/fetch.ts` | `fetchCatalog` | https GET |
| `catalog/store.ts` | `readCatalog`, `writeCatalog` | reads/writes catalog.json |
| `catalog/refresh.ts` | `TTL_MS`, `isStale`, `refreshCatalog` | calls fetch + writeCatalog |
| `resolve/direct.ts` | `DirectHit`, `directLookup` | none |
| `resolve/heuristic.ts` | `PROVIDER_ALIASES`, `heuristicLookup` | none |
| `resolve/llm.ts` | `LlmResult`, `llmResolve` | LLM call via `complete()` |
| `resolve/cascade.ts` | `loadEquivalences`, `saveEquivalences`, `resolveModel` | reads/writes equivalences.json |
| `logo/download.ts` | `ensureLogoSvg` | https GET, writes .svg |
| `logo/rasterize.ts` | `rasterizeLogo` | spawns `rsvg-convert`, writes .png, may notify once |
| `render/icons.ts` | `CapabilityIcons`, `CAPABILITY_ICONS`, `PROVIDER_EMOJI`, `providerEmoji` | none |
| `render/format.ts` | `formatPrice`, `formatTokenLimit`, `activeIcons`, `activeLabels`, `formatKnowledge` | none |
| `render/widget.ts` | `WidgetFactory`, `buildWidgetFactory` | none |
| `index.ts` | `default export (pi: ExtensionAPI) => void` | subscribes to events, sets widget |

---

## Open caveats deliberately preserved from spec

1. **No 404 detection for missing logos** — see Decision 2. We render whatever models.dev returns (sometimes a generic sparkle SVG). Documented; not a bug.
2. **`auth` shape on `ctx.modelRegistry.getApiKeyAndHeaders`** — assumed to be `{ ok: boolean; apiKey?: string; headers?: Record<string, string> }` based on the `context-compact` extension which uses the same pattern in production. If the actual return shape differs, narrow it in `index.ts` before calling `resolveModel`.
3. **`session_start` + `model_select` double-render guard** — handled by `lastRenderedKey`. If `model_select` with `source: "restore"` fires during `session_start`, the second call is a no-op.
4. **`Container` is vertical-only** — confirmed by reading `pi-tui/dist/tui.d.ts`. Hence Fallback A layout. If a future pi-tui release adds horizontal containers, the widget can be rewritten to 2 lines without changing any other file.
