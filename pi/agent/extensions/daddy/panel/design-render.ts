// Design-mode body: left = VSM>SIPOC>node tree, right = fields of the selected node.
// designRows/nodeAtRow are the shared row model so view.ts can map a selected row to a node
// for delete. Every line is opaque (padded text over a solid bg).
import type { ThemeColors } from "../lib/theme.ts";
import type { Workflow } from "../types.ts";
import { blankRow, joinColumns } from "./layout.ts";
import { bg, fg, pad } from "./palette.ts";

export interface DesignRow {
	text: string;
	nodeId?: string;
}

/** Flatten the workflow into selectable rows: a header per sipoc, then its nodes. */
export function designRows(wf: Workflow): DesignRow[] {
	const rows: DesignRow[] = [];
	for (const chain of wf.vsm) {
		rows.push({ text: `▸ ${chain.sipoc}` });
		for (const n of chain.nodes) rows.push({ text: `   ${n.id} [${n.action}${n.aiAssisted ? " · AI" : ""}]`, nodeId: n.id });
	}
	return rows;
}

/** The node id at a selected row, if that row is a node (not a sipoc header). */
export function nodeIdAtRow(wf: Workflow, row: number): string | undefined {
	return designRows(wf)[row]?.nodeId;
}

function detailColumn(wf: Workflow, selectedRow: number, theme: ThemeColors, width: number, height: number): string[] {
	const blank = bg(theme.panelBg, " ".repeat(width));
	const id = nodeIdAtRow(wf, selectedRow);
	const node = wf.vsm.flatMap((c) => c.nodes).find((n) => n.id === id);
	const lines = node
		? [
				[`id: ${node.id}`, theme.fg],
				[`action: ${node.action}`, theme.fg],
				[`aiAssisted: ${node.aiAssisted}`, theme.fg],
				[`depends_on: ${node.depends_on.join(", ") || "—"}`, theme.fg],
				[node.command ? `command: ${node.command}` : "", theme.muted],
			]
		: [["(select a node — edit fields in the YAML)", theme.dim]];
	const painted = (lines as Array<[string, string]>).filter(([t]) => t !== "").map(([t, hex]) => bg(theme.panelBg, fg(hex, pad(t, width))));
	while (painted.length < height) painted.push(blank);
	return painted.slice(0, height);
}

export function renderDesignBody(wf: Workflow, selected: number, theme: ThemeColors, width: number, height: number): string[] {
	const leftWidth = Math.min(30, Math.floor(width * 0.45));
	const gap = bg(theme.panelBg, fg(theme.dim, " │ "));
	const detailWidth = Math.max(1, width - leftWidth - 3);
	const rows = designRows(wf);
	const left: string[] = [];
	for (let i = 0; i < height; i++) {
		const row = rows[i];
		const rowBg = i === selected ? theme.selectedBg : theme.panelBg;
		if (!row) {
			left.push(bg(rowBg, " ".repeat(leftWidth)));
			continue;
		}
		const base = row.nodeId ? (i === selected ? theme.fg : theme.muted) : theme.blue;
		left.push(bg(rowBg, fg(base, pad(`${i === selected ? ">" : " "}${row.text}`, leftWidth))));
	}
	if (rows.length === 0) left[0] = bg(theme.panelBg, fg(theme.dim, pad("  empty — press 'a' to add a node", leftWidth)));
	const right = detailColumn(wf, selected, theme, detailWidth, height);
	return joinColumns(left, right, height, gap);
}
