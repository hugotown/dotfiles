// Up-front validation of agent names and the dependency graph. Pure logic, no SDK.
import type { AgentSpec } from "../types.ts";

export type GraphError =
	| { kind: "duplicate"; name: string }
	| { kind: "self-dependency"; name: string }
	| { kind: "unknown-dependency"; agent: string; dependency: string }
	| { kind: "cycle"; path: string[] };

function findCycle(agents: AgentSpec[]): string[] | null {
	const adjacency = new Map(agents.map((a) => [a.name, a.dependsOn ?? []]));
	const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited 1=on-stack 2=done
	const stack: string[] = [];
	const visit = (name: string): string[] | null => {
		state.set(name, 1);
		stack.push(name);
		for (const dep of adjacency.get(name) ?? []) {
			const s = state.get(dep) ?? 0;
			if (s === 1) return [...stack.slice(stack.indexOf(dep)), dep];
			if (s === 0) {
				const cycle = visit(dep);
				if (cycle) return cycle;
			}
		}
		stack.pop();
		state.set(name, 2);
		return null;
	};
	for (const a of agents) {
		if ((state.get(a.name) ?? 0) === 0) {
			const cycle = visit(a.name);
			if (cycle) return cycle;
		}
	}
	return null;
}

/** Returns the first graph error, or null when the graph is sound. */
export function validateGraph(agents: AgentSpec[]): GraphError | null {
	const names = new Set<string>();
	for (const a of agents) {
		if (names.has(a.name)) return { kind: "duplicate", name: a.name };
		names.add(a.name);
	}
	for (const a of agents) {
		for (const dep of a.dependsOn ?? []) {
			if (dep === a.name) return { kind: "self-dependency", name: a.name };
			if (!names.has(dep)) return { kind: "unknown-dependency", agent: a.name, dependency: dep };
		}
	}
	const cycle = findCycle(agents);
	return cycle ? { kind: "cycle", path: cycle } : null;
}

export function describeGraphError(err: GraphError): string {
	switch (err.kind) {
		case "duplicate":
			return `Duplicate agent name "${err.name}". Every agent must have a unique name.`;
		case "self-dependency":
			return `Agent "${err.name}" cannot depend on itself.`;
		case "unknown-dependency":
			return `Agent "${err.agent}" depends on unknown agent "${err.dependency}".`;
		case "cycle":
			return `Dependency cycle detected: ${err.path.join(" -> ")}.`;
	}
}
