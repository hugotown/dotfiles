// Run-mode body: left = per-node status markers (colored), right = selected node detail.
// Every line is padded to its column width and painted over a solid bg → fully opaque.
import { allNodes } from "../lib/flat-nodes.ts";
import type { ThemeColors } from "../lib/theme.ts";
import type { NodeState, StateMachine } from "../types.ts";
import { blankRow, joinColumns, MARK } from "./layout.ts";
import { bg, fg, pad } from "./palette.ts";

function windowStart(selected: number, count: number, height: number): number {
	return Math.max(0, Math.min(selected - Math.floor(height / 2), Math.max(0, count - height)));
}

function listColumn(nodes: NodeState[], selected: number, theme: ThemeColors, width: number, height: number): string[] {
	const start = windowStart(selected, nodes.length, height);
	const lines: string[] = [];
	for (let i = 0; i < height; i++) {
		const idx = start + i;
		const node = nodes[idx];
		const rowBg = idx === selected ? theme.selectedBg : theme.panelBg;
		if (!node) {
			lines.push(bg(rowBg, " ".repeat(width)));
			continue;
		}
		const [mark, markKey] = MARK[node.status];
		const label = pad(`${idx === selected ? ">" : " "} ${mark} ${node.id}`, width);
		const base = idx === selected ? theme.fg : theme.muted;
		lines.push(bg(rowBg, fg(base, label.slice(0, 2)) + fg(theme[markKey], label.slice(2, 3)) + fg(base, label.slice(3))));
	}
	return lines;
}

function detailColumn(node: NodeState | undefined, theme: ThemeColors, width: number, height: number): string[] {
	const blank = bg(theme.panelBg, " ".repeat(width));
	if (!node) return Array.from({ length: height }, () => blank);
	const head = `${node.id}  [${node.action}${node.aiAssisted ? " · AI" : ""}]  ${node.status}`;
	const rows: Array<[string, string]> = [[head, theme.blue]];
	for (const line of (node.output ?? "").split("\n")) rows.push([line, theme.fg]);
	const tail = rows.slice(0, height);
	const lines = tail.map(([t, hex]) => bg(theme.panelBg, fg(hex, pad(t, width))));
	while (lines.length < height) lines.push(blank);
	return lines;
}

export function renderRunBody(state: StateMachine | null, selected: number, theme: ThemeColors, width: number, height: number): string[] {
	const leftWidth = Math.min(28, Math.floor(width * 0.4));
	const gap = bg(theme.panelBg, fg(theme.dim, " │ "));
	const detailWidth = Math.max(1, width - leftWidth - 3);
	if (!state) {
		const msg = bg(theme.panelBg, fg(theme.dim, pad("  no active run — start one with --daddy-workflow <name>", width)));
		return [msg, ...Array.from({ length: height - 1 }, () => blankRow(theme, width))];
	}
	const nodes = allNodes(state);
	const left = listColumn(nodes, selected, theme, leftWidth, height);
	const right = detailColumn(nodes[selected], theme, detailWidth, height);
	return joinColumns(left, right, height, gap);
}
