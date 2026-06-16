// lib/summary.ts — Build the model-visible run summary text.
import type { RunState } from "../runtime-types.ts";
import { statusIcon } from "./format.ts";

export function buildSummary(state: RunState): string {
  const lines = [`Workflow "${state.workflow}" — ${state.status}`];
  for (const [id, n] of Object.entries(state.nodes)) {
    const head = n.output.split("\n")[0]?.slice(0, 80) ?? "";
    const acceptance = n.acceptance ? ` [${n.acceptance.provenance}]` : "";
    lines.push(`${statusIcon(n.status)} ${id}: ${n.status}${acceptance}${head ? ` — ${head}` : ""}`);
  }
  if (state.paused_node) {
    lines.push(`Paused at "${state.paused_node}". Use /daddy approve|reject.`);
  }
  return lines.join("\n");
}
