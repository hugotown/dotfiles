// lib/topo-sort.ts — Kahn-style topological layering (assumes acyclic; validator runs first).
import type { NodeDef } from "../types.ts";

export function toLayers(nodes: NodeDef[]): NodeDef[][] {
  const indeg = new Map(nodes.map((n) => [n.id, (n.depends_on ?? []).length]));
  const layers: NodeDef[][] = [];
  const done = new Set<string>();
  let frontier = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  while (frontier.length > 0) {
    layers.push(frontier);
    for (const n of frontier) done.add(n.id);
    frontier = nodes.filter(
      (n) => !done.has(n.id) && (n.depends_on ?? []).every((d) => done.has(d)),
    );
  }
  return layers;
}
