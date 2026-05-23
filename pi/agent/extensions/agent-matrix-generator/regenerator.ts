/**
 * Regenerator — CLI entry point and orchestration logic.
 * Invoked as a detached subprocess with --agent-matrix-regen flag.
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PROVIDERS, OUTPUT_DIR, SOURCE_DIR, REGEN_FLAG } from "./lib/constants";
import { log } from "./lib/log";
import { baseNameFromFile, readSourceFile } from "./lib/source-parser";
import { fetchCapabilities, lookupCaps } from "./lib/capabilities";
import { resolveAgentReqs, modelMatchesReqs } from "./lib/requirements";
import { fetchProviderModels } from "./lib/providers";
import { buildAgentMarkdown, writeIfChanged } from "./lib/markdown";
import { cleanupStaleFiles } from "./lib/cleanup";
import type { ProviderModel } from "./types";

const isRegenerator = process.argv.includes(REGEN_FLAG);

if (isRegenerator) {
  runRegenerator()
    .then(() => process.exit(0))
    .catch((err) => {
      log("regenerator crashed", { error: String(err) });
      process.exit(1);
    });
}

export async function runRegenerator(): Promise<void> {
  log("regenerator start");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const providerModels: ProviderModel[] = [];
  for (const providerId of PROVIDERS) {
    const models = fetchProviderModels(providerId);
    log("fetched models", { providerId, count: models.length });
    for (const modelId of models) providerModels.push({ providerId, modelId });
  }

  if (providerModels.length === 0) {
    log("no models fetched; aborting (leaving existing generated files in place)");
    return;
  }

  let sourceEntries: string[];
  try {
    sourceEntries = readdirSync(SOURCE_DIR);
  } catch (err) {
    log("source dir unreadable", { dir: SOURCE_DIR, error: String(err) });
    return;
  }
  const sourceFiles = sourceEntries
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .sort();
  log("found source files", { count: sourceFiles.length });
  if (sourceFiles.length === 0) return;

  const capabilities = await fetchCapabilities();
  const totalModels = Array.from(capabilities.values()).reduce((s, m) => s + m.size, 0);
  log("loaded capabilities", { providers: capabilities.size, totalModels });

  const expected = new Set<string>();
  let written = 0;
  let unchanged = 0;
  let fallbackHits = 0;
  const skipped: string[] = [];

  for (const file of sourceFiles) {
    const base = baseNameFromFile(file);
    const source = readSourceFile(file);
    if (!source) continue;
    const { reqs, profiles } = resolveAgentReqs(file, source.firstLine);
    log("resolved profiles", {
      agent: base,
      profiles,
      required: reqs.required ?? [],
      excluded: reqs.excluded ?? [],
    });
    let matched = 0;
    for (const { providerId, modelId } of providerModels) {
      const lookup = lookupCaps(capabilities, providerId, modelId);
      if (lookup.fellBack) fallbackHits++;
      if (!modelMatchesReqs(lookup.caps, reqs)) continue;
      const outName = `${base}-${providerId}-${modelId}.md`;
      expected.add(outName);
      const outPath = join(OUTPUT_DIR, outName);
      const content = buildAgentMarkdown({
        title: source.title,
        base,
        providerId,
        modelId,
        body: source.body,
      });
      if (writeIfChanged(outPath, content)) written++;
      else unchanged++;
      matched++;
    }
    if (matched === 0) {
      skipped.push(base);
      log("agent has no matching models; skipped", {
        agent: base,
        required: reqs.required ?? [],
      });
    }
  }
  if (fallbackHits > 0) {
    log("capability fallback used", {
      hits: fallbackHits,
      note: "exact provider+model not in models.dev; used another provider's record",
    });
  }

  const deleted = cleanupStaleFiles(expected);

  log("regenerator done", { written, unchanged, deleted, expectedTotal: expected.size, skippedAgents: skipped });
}
