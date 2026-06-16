import type { NodeState, RunState } from "../runtime-types.ts";

function duration(start?: string, end?: string): string {
  if (!start || !end) return "";
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return "";
  return ` (${Math.round(ms / 1000)}s)`;
}

function nodeLine(id: string, node: NodeState): string {
  const bits = [id, node.status];
  if (node.attempts) bits.push(`attempts=${node.attempts}`);
  if (node.model) bits.push(`model=${node.model}`);
  const acceptance = node.acceptance ? ` acceptance=${node.acceptance.provenance}` : "";
  const err = node.error ? ` — ${node.error}` : "";
  return `- ${bits.join(" ")}${duration(node.started_at, node.completed_at)}${acceptance}${err}`;
}

function nextActions(state: RunState): string {
  if (state.status === "paused") return "/daddy approve, /daddy reject, /daddy cancel";
  if (state.status === "failed") return "/daddy recover, /daddy retry <id> <node>, /daddy cancel";
  if (state.status === "running") return "/daddy cancel, /daddy status <id>";
  if (state.worktree && state.status === "completed") return "/daddy merge, /daddy remove, /daddy keep";
  return "none";
}

export function buildStatusReport(state: RunState, filePath?: string): string {
  const lines = [
    `Run ${state.id} — ${state.status}`,
    `workflow: ${state.workflow}`,
    `arguments: ${state.arguments || "(none)"}`,
    `base branch: ${state.base_branch}`,
    `started: ${state.started_at}`,
  ];
  if (state.completed_at) lines.push(`completed: ${state.completed_at}`);
  if (state.paused_node) lines.push(`paused node: ${state.paused_node}`);
  if (state.worktree) lines.push(`worktree: ${state.worktree.branch} at ${state.worktree.path}`);
  lines.push(`artifacts: ${state.artifacts_dir}`);
  if (filePath) lines.push(`run file: ${filePath}`);
  lines.push("", "Nodes");
  for (const [id, node] of Object.entries(state.nodes)) lines.push(nodeLine(id, node));
  lines.push("", `next actions: ${nextActions(state)}`);
  return lines.join("\n");
}
