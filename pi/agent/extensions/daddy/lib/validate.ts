// Static validation before any node runs (design §11). Returns the FIRST error or null.
import { collectRefs } from "./resolve-refs.ts";
import type { Action, Workflow, WorkflowNode } from "../types.ts";

export type ValidationError =
	| { kind: "bad-name"; name: string }
	| { kind: "duplicate"; id: string }
	| { kind: "self-dependency"; id: string }
	| { kind: "unknown-dependency"; node: string; dependency: string }
	| { kind: "cycle"; path: string[] }
	| { kind: "unknown-ref"; node: string; ref: string }
	| { kind: "missing-field"; node: string; field: string }
	| { kind: "bad-ai-assisted"; node: string };

const FLAT = (wf: Workflow): WorkflowNode[] => wf.vsm.flatMap((c) => c.nodes);

const REQUIRED: Record<Action, (n: WorkflowNode) => string | null> = {
	bash: (n) => (n.command ? null : "command"),
	flag: (n) => (n.flag ? null : "flag"),
	llm: (n) => (n.provider && n.model && n.variant && n.prompt ? null : "provider/model/variant/prompt"),
	ask: (n) => (n.aiAssisted ? (n.prompt ? null : "prompt") : n.questions?.length ? null : "questions"),
};

const AI_OK: Record<Action, (ai: boolean) => boolean> = {
	bash: (ai) => ai === false,
	flag: (ai) => ai === false,
	llm: (ai) => ai === true,
	ask: () => true,
};

/** Ancestors reachable via depends_on (transitive). */
function ancestors(id: string, byId: Map<string, WorkflowNode>): Set<string> {
	const seen = new Set<string>();
	const stack = [...(byId.get(id)?.depends_on ?? [])];
	while (stack.length) {
		const cur = stack.pop()!;
		if (seen.has(cur)) continue;
		seen.add(cur);
		stack.push(...(byId.get(cur)?.depends_on ?? []));
	}
	return seen;
}

function findCycle(nodes: WorkflowNode[], byId: Map<string, WorkflowNode>): string[] | null {
	const state = new Map<string, 0 | 1 | 2>(); // 0 visiting, 2 done
	const path: string[] = [];
	const visit = (id: string): string[] | null => {
		if (state.get(id) === 2) return null;
		if (state.get(id) === 0) return [...path, id];
		state.set(id, 0);
		path.push(id);
		for (const dep of byId.get(id)?.depends_on ?? []) {
			const c = visit(dep);
			if (c) return c;
		}
		path.pop();
		state.set(id, 2);
		return null;
	};
	for (const n of nodes) {
		const c = visit(n.id);
		if (c) return c;
	}
	return null;
}

export function validateWorkflow(wf: Workflow): ValidationError | null {
	if (!/^\S+$/.test(wf.name)) return { kind: "bad-name", name: wf.name };
	const nodes = FLAT(wf);
	const byId = new Map<string, WorkflowNode>();
	for (const n of nodes) {
		if (byId.has(n.id)) return { kind: "duplicate", id: n.id };
		byId.set(n.id, n);
	}
	for (const n of nodes) {
		if (!AI_OK[n.action](n.aiAssisted)) return { kind: "bad-ai-assisted", node: n.id };
		const missing = REQUIRED[n.action](n);
		if (missing) return { kind: "missing-field", node: n.id, field: missing };
		for (const dep of n.depends_on) {
			if (dep === n.id) return { kind: "self-dependency", id: n.id };
			if (!byId.has(dep)) return { kind: "unknown-dependency", node: n.id, dependency: dep };
		}
	}
	const cycle = findCycle(nodes, byId);
	if (cycle) return { kind: "cycle", path: cycle };
	for (const n of nodes) {
		const anc = ancestors(n.id, byId);
		for (const ref of collectRefs(`${n.prompt ?? ""} ${n.command ?? ""}`)) {
			if (!anc.has(ref)) return { kind: "unknown-ref", node: n.id, ref };
		}
	}
	return null;
}
