// Render design-mode: left = VSM>SIPOC>node tree, right = detail of the selected element.
// Editing keys are handled by view.ts in design mode (Tab toggles from run mode).
import { joinColumns } from "./layout.ts";
import type { Workflow } from "../types.ts";

export function renderDesign(wf: Workflow, selected: number, width: number): string[] {
	const rows: string[] = [];
	for (const chain of wf.vsm) {
		rows.push(`▸ ${chain.sipoc}`);
		for (const n of chain.nodes) rows.push(`   ${n.id} [${n.action}${n.aiAssisted ? " · AI" : ""}]`);
	}
	const height = Math.max(6, rows.length + 1);
	const leftWidth = Math.min(30, Math.floor(width * 0.4));
	const left = rows.map((r, i) => `${i === selected ? ">" : " "}${r}`.slice(0, leftWidth));
	const flat = wf.vsm.flatMap((c) => c.nodes);
	const node = flat[Math.max(0, selected - 1)];
	const detail = node ? [`id: ${node.id}`, `action: ${node.action}`, `aiAssisted: ${node.aiAssisted}`, `depends_on: ${node.depends_on.join(", ")}`] : ["(select a node)"];
	return [` daddy · design · ${wf.name}`.padEnd(width), ...joinColumns(left, detail, height, leftWidth, "  ")];
}
