// lib/state.ts — Persist/restore RunState as JSON files under <home>/runs/.
import * as fs from "node:fs";
import * as path from "node:path";
import type { RunState } from "../runtime-types.ts";

function runsDir(home: string): string { return path.join(home, "runs"); }

export function saveRun(home: string, state: RunState): void {
  fs.mkdirSync(runsDir(home), { recursive: true });
  fs.writeFileSync(path.join(runsDir(home), `${state.id}.json`), JSON.stringify(state, null, 2));
}

export function loadRun(home: string, id: string): RunState | null {
  try { return JSON.parse(fs.readFileSync(path.join(runsDir(home), `${id}.json`), "utf-8")); }
  catch { return null; }
}

export function listRuns(home: string): RunState[] {
  try {
    return fs.readdirSync(runsDir(home)).filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir(home), f), "utf-8")));
  } catch { return []; }
}
