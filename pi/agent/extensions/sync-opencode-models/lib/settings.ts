import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { PROVIDERS, type SyncedProvider, log, runOpencodeModels } from "./models";

const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");

function mergeEnabledModels(
  previous: string[],
  freshByProvider: Map<SyncedProvider, string[]>,
): string[] {
  const isManaged = (id: string): boolean =>
    PROVIDERS.some((p) => id.startsWith(`${p}/`));

  let anchor = previous.findIndex(isManaged);
  if (anchor === -1) anchor = previous.length;

  const finalBlocks: string[] = [];
  for (const provider of PROVIDERS) {
    const fresh = freshByProvider.get(provider) ?? [];
    if (fresh.length > 0) {
      finalBlocks.push(...fresh);
    } else {
      const kept = previous.filter((id) => id.startsWith(`${provider}/`));
      if (kept.length > 0) {
        log("warn", `provider '${provider}' returned no models; preserving ${kept.length} existing`);
      }
      finalBlocks.push(...kept);
    }
  }

  const survivors = previous.filter((id) => !isManaged(id));
  return [...survivors.slice(0, anchor), ...finalBlocks, ...survivors.slice(anchor)];
}

async function writeSettingsAtomic(target: string, json: string): Promise<void> {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, target);
}

export async function syncSettings(): Promise<void> {
  const [opencodeGo, opencode] = await Promise.all([
    runOpencodeModels("opencode-go"),
    runOpencodeModels("opencode"),
  ]);
  const fresh = new Map<SyncedProvider, string[]>([
    ["opencode-go", opencodeGo],
    ["opencode", opencode],
  ]);

  if (opencodeGo.length + opencode.length === 0) {
    log("warn", "both providers returned no models; skipping write");
    return;
  }

  const raw = await fs.readFile(SETTINGS_PATH, "utf8");
  const settings = JSON.parse(raw) as Record<string, unknown>;

  if (!Array.isArray(settings.enabledModels)) {
    log("warn", "settings.enabledModels missing or not an array; skipping");
    return;
  }

  const previous = (settings.enabledModels as string[]).slice();
  const merged = mergeEnabledModels(previous, fresh);

  if (merged.length === previous.length && merged.every((id, i) => id === previous[i])) {
    log("info", "enabledModels already in sync; nothing to write");
    return;
  }

  settings.enabledModels = merged;
  await writeSettingsAtomic(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);

  const before = new Set(previous.filter((id) => id.startsWith("opencode")));
  const after = new Set(merged.filter((id) => id.startsWith("opencode")));
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  log("info", `synced (added=${added.length} removed=${removed.length})`);
}
