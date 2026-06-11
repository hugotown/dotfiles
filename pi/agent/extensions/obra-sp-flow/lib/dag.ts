// Topological levels over the file contracts. Files whose dependencies are all
// satisfied land in the same level and implement in parallel; levels run in
// sequence. A dependency cycle dumps the remainder into one final level.

import type { FileContract } from "../types.ts";

export function buildLevels(contracts: FileContract[]): FileContract[][] {
  const known = new Set(contracts.map((c) => c.path));
  const done = new Set<string>();
  const levels: FileContract[][] = [];
  let remaining = [...contracts];

  while (remaining.length) {
    const ready = remaining.filter((c) => c.dependsOn.every((d) => !known.has(d) || done.has(d)));
    if (ready.length === 0) {
      levels.push(remaining); // cycle / unresolved: emit rest as a final level
      break;
    }
    for (const c of ready) done.add(c.path);
    levels.push(ready);
    remaining = remaining.filter((c) => !done.has(c.path));
  }
  return levels;
}
