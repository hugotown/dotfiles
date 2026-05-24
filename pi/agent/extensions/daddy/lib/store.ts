// In-memory snapshot of the current run, for the panel's live view. The driver publishes
// the StateMachine after each persist; the panel subscribes for re-renders.
import type { StateMachine } from "../types.ts";

type Listener = () => void;
let current: StateMachine | null = null;
const listeners = new Set<Listener>();

export function publishRun(state: StateMachine | null): void {
	current = state;
	for (const l of listeners) l();
}

export function getRun(): StateMachine | null {
	return current;
}

export function hasActiveRun(): boolean {
	return current !== null && current.vsm.some((c) => c.nodes.some((n) => n.status === "running" || n.status === "pending"));
}

export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
