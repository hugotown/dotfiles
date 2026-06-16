import type { NodeDef, WorkflowDef } from "../types.ts";

function nodeText(node: NodeDef): string {
  return [node.bash, node.cancel, node.prompt, node.command, node.loop?.prompt, node.script?.inline].filter(Boolean).join("\n");
}

function sideEffects(def: WorkflowDef): string[] {
  const hits = new Set<string>();
  for (const node of def.nodes) {
    const text = nodeText(node);
    if (/gh\s+pr\s+create/.test(text)) hits.add("gh pr create");
    if (/gh\s+pr\s+merge/.test(text)) hits.add("gh pr merge");
    if (/wt\s+merge/.test(text)) hits.add("wt merge");
    if (/rm\s+-rf/.test(text)) hits.add("rm -rf");
  }
  return Array.from(hits);
}

function edges(def: WorkflowDef): string[] {
  const result: string[] = [];
  for (const node of def.nodes) {
    for (const dep of node.depends_on ?? []) result.push(`${dep} -> ${node.id}`);
  }
  return result;
}

export function buildPreflightReport(def: WorkflowDef, args: string): string {
  const effects = sideEffects(def);
  const graph = edges(def);
  const lines = [
    `Preflight: ${def.name}`,
    def.description,
    `arguments: ${args || "(none)"}`,
    `worktree: ${def.worktree ? "enabled" : "disabled"}`,
    `concurrency: ${def.concurrency ?? 4}`,
    "",
    "Nodes",
    ...def.nodes.map((node) => `- ${node.id}${node.depends_on?.length ? ` after ${node.depends_on.join(", ")}` : ""}`),
    "",
    "Edges",
    ...(graph.length ? graph : ["none"]),
    "",
    `side effects: ${effects.length ? effects.join(", ") : "none detected"}`,
  ];
  if (!def.acceptance && def.nodes.every((node) => !node.acceptance)) lines.push("warning: no acceptance configured");
  return lines.join("\n");
}
