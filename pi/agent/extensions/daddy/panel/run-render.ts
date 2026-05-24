// Render the run-mode view: left = per-node status markers, right = selected node detail.
import { allNodes } from "../lib/flat-nodes.ts";
import { joinColumns, statusMarker } from "./layout.ts";
import type { StateMachine } from "../types.ts";

export function renderRun(state: StateMachine | null, selected: number, width: number): string[] {
	if (!state) return ["daddy: no active run."];
	const nodes = allNodes(state);
	const height = Math.max(6, nodes.length + 1);
	const leftWidth = Math.min(28, Math.floor(width * 0.35));
	const left = nodes.map((n, i) => `${i === selected ? ">" : " "}${statusMarker(n.status)} ${n.id}`.slice(0, leftWidth));
	const node = nodes[selected];
	const detail = node
		? [`${node.id} [${node.action}${node.aiAssisted ? " · AI" : ""}]`, `status: ${node.status}`, "", ...(node.output ?? "").split("\n").slice(0, height - 3)]
		: [];
	const title = ` daddy · ${state.workflow} (${nodes.filter((n) => n.status === "ok").length}/${nodes.length})`;
	return [title.padEnd(width), ...joinColumns(left, detail, height, leftWidth, "  ")];
}
