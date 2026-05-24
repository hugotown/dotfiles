// State machine of the subagent runs WE own (pi does not track these).
// Holds the most recent run's agents; "working" is derived from their statuses.
// The panel reads this and subscribes for live streaming updates.
import type { AgentResult } from "../result.ts";

type Listener = () => void;

let current: AgentResult[] = [];
const listeners = new Set<Listener>();

/** Replace the current run snapshot and notify subscribers. */
export function publishRun(results: AgentResult[]): void {
	current = [...results];
	for (const listener of listeners) listener();
}

export function getRun(): AgentResult[] {
	return current;
}

/** Gate condition: at least one agent is running right now. */
export function hasWorkingSubagent(): boolean {
	return current.some((r) => r.status === "running");
}

export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
