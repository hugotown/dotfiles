// lib/trigger-rule.ts — Join semantics: should a node run given its deps' states?
import type { NodeDef } from "../types.ts";
import type { NodeState } from "../runtime-types.ts";

export function shouldExecute(node: NodeDef, states: Record<string, NodeState>): boolean {
  const deps = node.depends_on ?? [];
  if (deps.length === 0) return true;
  const ss = deps.map((d) => states[d]?.status ?? "pending");
  const ok = (s: string) => s === "completed";
  const failed = (s: string) => s === "failed" || s === "cancelled";
  const done = (s: string) => ok(s) || failed(s) || s === "skipped";
  switch (node.trigger_rule ?? "all_success") {
    case "one_success": return ss.some(ok);
    case "all_done": return ss.every(done);
    case "none_failed_min_one_success": return !ss.some(failed) && ss.some(ok);
    default: return ss.every(ok);
  }
}
