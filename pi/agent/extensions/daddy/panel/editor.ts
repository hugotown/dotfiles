// Pure design-mode tree operations. No rendering, no I/O — fully unit-testable (§15).
import { stringify } from "yaml";
import type { SipocChain, Workflow, WorkflowNode } from "../types.ts";

const clone = (wf: Workflow): Workflow => structuredClone(wf);

export function addSipoc(wf: Workflow, sipoc: string): Workflow {
	const next = clone(wf);
	next.vsm.push({ sipoc, nodes: [] });
	return next;
}

export function addNode(wf: Workflow, sipoc: string, node: WorkflowNode): Workflow {
	const next = clone(wf);
	const chain = next.vsm.find((c: SipocChain) => c.sipoc === sipoc);
	if (chain) chain.nodes.push(node);
	return next;
}

export function connect(wf: Workflow, nodeId: string, dependency: string): Workflow {
	const next = clone(wf);
	for (const c of next.vsm) for (const n of c.nodes) if (n.id === nodeId && !n.depends_on.includes(dependency)) n.depends_on.push(dependency);
	return next;
}

export function removeNode(wf: Workflow, nodeId: string): Workflow {
	const next = clone(wf);
	for (const c of next.vsm) {
		c.nodes = c.nodes.filter((n) => n.id !== nodeId);
		for (const n of c.nodes) n.depends_on = n.depends_on.filter((d) => d !== nodeId);
	}
	return next;
}

export function toYaml(wf: Workflow): string {
	return stringify(wf);
}
