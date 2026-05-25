// List-mode body: left = every workflow in the project, right = the node tree of the hovered
// one. Read-only preview (navigate with ↑/↓ j/k; enter/l opens it in design). Opaque rows.
import type { ThemeColors } from "../lib/theme.ts";
import type { Workflow } from "../types.ts";
import { designRows } from "./design-render.ts";
import { blankRow, joinColumns } from "./layout.ts";
import { bg, fg, pad } from "./palette.ts";

export interface WorkflowEntry {
	name: string;
	wf: Workflow | null;
}

export function renderListBody(items: WorkflowEntry[], selected: number, theme: ThemeColors, width: number, height: number): string[] {
	const leftWidth = Math.min(32, Math.floor(width * 0.4));
	const gap = bg(theme.panelBg, fg(theme.dim, " │ "));
	const detailWidth = Math.max(1, width - leftWidth - 3);
	if (items.length === 0) {
		const msg = bg(theme.panelBg, fg(theme.dim, pad("  no workflows in .pi/daddy/workflows — create one with --daddy-design", width)));
		return [msg, ...Array.from({ length: height - 1 }, () => blankRow(theme, width))];
	}

	const left: string[] = [];
	for (let i = 0; i < height; i++) {
		const it = items[i];
		const rowBg = i === selected ? theme.selectedBg : theme.panelBg;
		if (!it) {
			left.push(bg(rowBg, " ".repeat(leftWidth)));
			continue;
		}
		const base = it.wf ? (i === selected ? theme.fg : theme.muted) : theme.red;
		left.push(bg(rowBg, fg(base, pad(`${i === selected ? ">" : " "} ${it.name}`, leftWidth))));
	}

	const sel = items[Math.min(selected, items.length - 1)];
	const right: string[] = [];
	if (!sel?.wf) {
		right.push(bg(theme.panelBg, fg(theme.red, pad(`  ${sel?.name ?? ""}: invalid or unreadable YAML`, detailWidth))));
	} else {
		const count = sel.wf.vsm.reduce((n, c) => n + c.nodes.length, 0);
		right.push(bg(theme.panelBg, fg(theme.blue, pad(`${sel.wf.name} — ${count} node(s)`, detailWidth))));
		for (const r of designRows(sel.wf)) right.push(bg(theme.panelBg, fg(r.nodeId ? theme.fg : theme.dim, pad(r.text, detailWidth))));
	}
	while (right.length < height) right.push(blankRow(theme, detailWidth));
	return joinColumns(left, right.slice(0, height), height, gap);
}
