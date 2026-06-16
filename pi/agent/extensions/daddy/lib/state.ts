// lib/state.ts — Persist/restore RunState as JSON files under <home>/runs/.
import * as fs from "node:fs";
import * as path from "node:path";
import type { RunState } from "../runtime-types.ts";
import type { StreamEntry } from "../panel/store.ts";

function runsDir(home: string): string { return path.join(home, "runs"); }

export function runFile(home: string, id: string): string {
  return path.join(runsDir(home), `${id}.json`);
}

export function saveRun(home: string, state: RunState): void {
  fs.mkdirSync(runsDir(home), { recursive: true });
  fs.writeFileSync(runFile(home, state.id), JSON.stringify(state, null, 2));
}

export function loadRun(home: string, id: string): RunState | null {
  try { return JSON.parse(fs.readFileSync(runFile(home, id), "utf-8")); }
  catch { return null; }
}

export function findRun(home: string, idOrPrefix: string): RunState | null {
  if (!idOrPrefix) return null;
  const exact = loadRun(home, idOrPrefix);
  if (exact) return exact;
  const matches = listRuns(home).filter((r) => r.id.startsWith(idOrPrefix));
  return matches.length === 1 ? matches[0] : null;
}

export function listRuns(home: string): RunState[] {
  try {
    return fs.readdirSync(runsDir(home)).filter((f) => f.endsWith(".json") && !f.endsWith(".streams.json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir(home), f), "utf-8")));
  } catch { return []; }
}

export function saveStreams(home: string, id: string, streams: Record<string, StreamEntry[]>): void {
  try {
    fs.mkdirSync(runsDir(home), { recursive: true });
    fs.writeFileSync(path.join(runsDir(home), `${id}.streams.json`), JSON.stringify(streams));
  } catch { /* best-effort persistence */ }
}

export function loadStreams(home: string, id: string): Record<string, StreamEntry[]> {
  try { return JSON.parse(fs.readFileSync(path.join(runsDir(home), `${id}.streams.json`), "utf-8")); }
  catch { return {}; }
}
