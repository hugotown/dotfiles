// Pure DAG helpers for the parallel implementation phase.
// Inputs are file contracts whose `dependsOn` references OTHER task ids.
// Convention (from M2): the task id used in dependsOn is "task-<n>" matching the
// markdown plan, but M3 only needs ids to be opaque strings that match between
// the contract's own id and the dependsOn array of OTHERS. To keep the dispatcher
// simple, we use the contract's `path` as its task id (paths are unique).

import type { FileContract } from "./state.ts";
import * as fs from "node:fs";
import * as path from "node:path";

export interface DagNode {
  /** Stable id used by this DAG (we use the contract's path). */
  id: string;
  contract: FileContract;
}

export interface DagLevels {
  levels: DagNode[][];
}

export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cycle in file contracts: ${cycle.join(" -> ")}`);
  }
}

/**
 * Build levels: each level contains nodes whose dependencies all live in earlier levels.
 * Level 0 = no dependencies. Level N = depends only on level < N.
 *
 * `dependsOn` in a FileContract references task ids ("task-1", "task-2"...). M3 cannot
 * resolve those ids to FileContracts because the mapping is implicit in the plan markdown.
 * Therefore we treat `dependsOn` as referencing CONTRACT PATHS (M2's plan_with_contracts
 * tool is documented to use task-N ids, but for the DAG to function deterministically the
 * implementer prompt tells the implementer that each task corresponds 1:1 to a fileContract;
 * we resolve dependencies via the `imports` array, which DOES reference other contract paths).
 *
 * In other words: this implementation uses `imports` (other contract paths) to build the DAG,
 * NOT `dependsOn` (task ids). `imports` is the authoritative cross-contract relation per the
 * contract schema. `dependsOn` remains useful for human-readable plan reading.
 */
export function buildLevels(contracts: FileContract[]): DagLevels {
  const byPath = new Map<string, FileContract>();
  for (const c of contracts) byPath.set(c.path, c);

  // Edge: from each contract to the contracts it imports (deps must finish first).
  const deps = new Map<string, Set<string>>();
  for (const c of contracts) {
    const set = new Set<string>();
    for (const imp of c.imports) {
      if (byPath.has(imp)) set.add(imp);
    }
    deps.set(c.path, set);
  }

  // Detect cycles via DFS while assigning levels via Kahn's algorithm.
  detectCycle(contracts, deps);

  const remaining = new Set(contracts.map((c) => c.path));
  const levels: DagNode[][] = [];

  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const path of remaining) {
      const d = deps.get(path)!;
      let allDone = true;
      for (const dep of d) {
        if (remaining.has(dep)) { allDone = false; break; }
      }
      if (allDone) ready.push(path);
    }
    if (ready.length === 0) {
      // Shouldn't happen after detectCycle, but defend.
      throw new CycleError(Array.from(remaining));
    }
    levels.push(ready.map((p) => ({ id: p, contract: byPath.get(p)! })));
    for (const p of ready) remaining.delete(p);
  }

  return { levels };
}

function detectCycle(contracts: FileContract[], deps: Map<string, Set<string>>): void {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const c of contracts) color.set(c.path, WHITE);
  const stack: string[] = [];

  const visit = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of deps.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const cycleStart = stack.indexOf(next);
        const cycle = stack.slice(cycleStart).concat(next);
        throw new CycleError(cycle);
      }
      if (c === WHITE) visit(next);
    }
    color.set(node, BLACK);
    stack.pop();
  };

  for (const c of contracts) {
    if (color.get(c.path) === WHITE) visit(c.path);
  }
}

/**
 * Validate that all `imports` in file contracts reference either another contract
 * or an existing file on disk. Returns list of dangling imports (empty = valid).
 */
export function validateImports(contracts: FileContract[], cwd: string): string[] {
  const contractPaths = new Set(contracts.map((c) => c.path));
  const dangling: string[] = [];
  for (const c of contracts) {
    for (const imp of c.imports) {
      if (contractPaths.has(imp)) continue;
      if (fs.existsSync(path.resolve(cwd, imp))) continue;
      dangling.push(`${c.path} imports "${imp}" (not a contract and not on disk)`);
    }
  }
  return dangling;
}
