import { findRun, listRuns, saveRun } from "./state.ts";
import type { NodeDef } from "../types.ts";

const nowIso = () => new Date().toISOString();

export function cancelRun(home: string, id: string, reason: string): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  run.status = "cancelled";
  run.completed_at = nowIso();
  for (const node of Object.values(run.nodes)) {
    if (node.status === "running" || node.status === "pending") {
      node.status = "cancelled";
      node.error = reason || "cancelled";
      node.completed_at = nowIso();
    }
  }
  saveRun(home, run);
  return `Run ${run.id} cancelled${reason ? `: ${reason}` : "."}`;
}

export function recoverRun(home: string, id: string): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  if (run.status !== "running") return `Run ${run.id} does not need recovery; status is ${run.status}.`;
  run.status = "failed";
  run.completed_at = nowIso();
  for (const node of Object.values(run.nodes)) {
    if (node.status === "running") {
      node.status = "failed";
      node.error = "Recovered stale running node as failed.";
      node.completed_at = nowIso();
    }
  }
  saveRun(home, run);
  return `Run ${run.id} recovered as failed.`;
}

function downstreamOf(nodes: NodeDef[], start: string): Set<string> {
  const result = new Set<string>([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!result.has(node.id) && (node.depends_on ?? []).some((dep) => result.has(dep))) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function resetNodeForRetry(home: string, id: string, nodeId: string, nodes: NodeDef[]): string {
  const run = findRun(home, id);
  if (!run) return `Run not found or ambiguous: ${id}`;
  if (!nodes.some((node) => node.id === nodeId)) return `Node not found in workflow: ${nodeId}`;
  const reset = downstreamOf(nodes, nodeId);
  for (const key of reset) delete run.nodes[key];
  run.status = "running";
  run.completed_at = undefined;
  run.paused_node = undefined;
  saveRun(home, run);
  return `Reset ${Array.from(reset).join(", ")} for retry in run ${run.id}. Use /daddy resume ${run.id}.`;
}

export function cleanupReport(home: string, now = new Date()): string {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const candidates = listRuns(home).filter((run) =>
    ["completed", "failed", "cancelled"].includes(run.status) && Date.parse(run.completed_at ?? run.started_at) < cutoff,
  );
  if (candidates.length === 0) return "No cleanup candidates.";
  return ["Cleanup candidates", ...candidates.map((run) => `- ${run.id} ${run.status} ${run.workflow}`)].join("\n");
}
