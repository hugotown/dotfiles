// Pure DAG helpers for the parallel implementation phase.
// Uses `imports` (other contract paths) to build the DAG.

import * as fs from "node:fs";
import * as path from "node:path";
import type { FileContract } from "./state.ts";
import { CycleError, detectCycle } from "./dag-cycle.ts";

export { CycleError };

export interface DagNode { id: string; contract: FileContract }
export interface DagLevels { levels: DagNode[][] }

/**
 * Build levels: level 0 = no deps, level N = depends only on level < N.
 * Uses `imports` array to determine cross-contract dependencies.
 */
export function buildLevels(contracts: FileContract[]): DagLevels {
  const byPath = new Map<string, FileContract>();
  for (const c of contracts) byPath.set(c.path, c);

  const deps = new Map<string, Set<string>>();
  for (const c of contracts) {
    const set = new Set<string>();
    for (const imp of c.imports) { if (byPath.has(imp)) set.add(imp); }
    deps.set(c.path, set);
  }

  detectCycle(contracts, deps);

  const remaining = new Set(contracts.map((c) => c.path));
  const levels: DagNode[][] = [];
  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const p of remaining) {
      const d = deps.get(p)!;
      if ([...d].every((dep) => !remaining.has(dep))) ready.push(p);
    }
    if (ready.length === 0) throw new CycleError(Array.from(remaining));
    levels.push(ready.map((p) => ({ id: p, contract: byPath.get(p)! })));
    for (const p of ready) remaining.delete(p);
  }
  return { levels };
}

/** Validate that all `imports` reference another contract or an existing file on disk. */
export function validateImports(contracts: FileContract[], cwd: string): string[] {
  const contractPaths = new Set(contracts.map((c) => c.path));
  const dangling: string[] = [];
  for (const c of contracts) {
    for (const imp of c.imports) {
      if (!contractPaths.has(imp) && !fs.existsSync(path.resolve(cwd, imp))) {
        dangling.push(`${c.path} imports "${imp}" (not a contract and not on disk)`);
      }
    }
  }
  return dangling;
}
