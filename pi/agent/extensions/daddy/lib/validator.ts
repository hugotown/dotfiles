// lib/validator.ts — Validate node shape + DAG integrity. Returns error message or null.
import type { WorkflowDef, NodeDef, NodeType } from "../types.ts";

const TYPE_KEYS: NodeType[] = ["prompt", "command", "bash", "script", "loop", "approval", "cancel"];

function typeCount(node: NodeDef): number {
  return TYPE_KEYS.filter((k) => (node as unknown as Record<string, unknown>)[k] !== undefined).length;
}

function findCycle(nodes: NodeDef[]): string[] | null {
  const adj = new Map(nodes.map((n) => [n.id, n.depends_on ?? []]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1); stack.push(id);
    for (const dep of adj.get(id) ?? []) {
      const s = state.get(dep) ?? 0;
      if (s === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (s === 0) { const c = visit(dep); if (c) return c; }
    }
    stack.pop(); state.set(id, 2); return null;
  };
  for (const n of nodes) if ((state.get(n.id) ?? 0) === 0) { const c = visit(n.id); if (c) return c; }
  return null;
}

export function validateWorkflow(def: WorkflowDef): string | null {
  const ids = new Set<string>();
  for (const n of def.nodes) {
    if (!n.id) return "Every node needs an 'id'";
    if (ids.has(n.id)) return `Duplicate node id "${n.id}"`;
    ids.add(n.id);
    const tc = typeCount(n);
    if (tc !== 1) return `Node "${n.id}" must have exactly one type field (has ${tc})`;
    if (n.loop && n.retry) return `Loop node "${n.id}" cannot use retry`;
  }
  for (const n of def.nodes) for (const dep of n.depends_on ?? []) {
    if (dep === n.id) return `Node "${n.id}" cannot depend on itself"`;
    if (!ids.has(dep)) return `Node "${n.id}" depends on unknown node "${dep}"`;
  }
  const cycle = findCycle(def.nodes);
  return cycle ? `Dependency cycle: ${cycle.join(" -> ")}` : null;
}
