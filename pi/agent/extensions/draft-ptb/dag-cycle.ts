// DAG cycle detection for file contract dependency graphs.

import type { FileContract } from "./state.ts";

export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cycle in file contracts: ${cycle.join(" -> ")}`);
  }
}

export function detectCycle(contracts: FileContract[], deps: Map<string, Set<string>>): void {
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
        throw new CycleError(stack.slice(cycleStart).concat(next));
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
