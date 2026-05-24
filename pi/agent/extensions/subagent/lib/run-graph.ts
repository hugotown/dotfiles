// Executes agents honoring the dependency graph: independent agents run in parallel
// (bounded by concurrency); a dependent waits for its dependencies and receives their
// results. If a dependency does not succeed, the dependent is skipped (propagates).
import type { AgentResult } from "../result.ts";
import type { AgentSpec } from "../types.ts";
import { createSemaphore } from "./semaphore.ts";

export type RunOne = (spec: AgentSpec, deps: AgentResult[]) => Promise<AgentResult>;
export type MakeSkipped = (spec: AgentSpec, reason: string) => AgentResult;

export async function runGraph(
	agents: AgentSpec[],
	runOne: RunOne,
	makeSkipped: MakeSkipped,
	concurrency: number,
): Promise<Map<string, AgentResult>> {
	const specByName = new Map(agents.map((a) => [a.name, a]));
	const results = new Map<string, AgentResult>();
	const inFlight = new Map<string, Promise<AgentResult>>();
	// Acquire only AFTER dependencies resolve, so a waiting parent never holds a slot.
	const semaphore = createSemaphore(concurrency);

	const run = (name: string): Promise<AgentResult> => {
		const existing = inFlight.get(name);
		if (existing) return existing;
		const spec = specByName.get(name)!;
		const promise = (async (): Promise<AgentResult> => {
			const deps = await Promise.all((spec.dependsOn ?? []).map(run));
			const failed = deps.find((d) => d.status !== "ok");
			if (failed) {
				const skipped = makeSkipped(spec, `dependency "${failed.name}" did not succeed (${failed.status})`);
				results.set(name, skipped);
				return skipped;
			}
			await semaphore.acquire();
			try {
				const result = await runOne(spec, deps);
				results.set(name, result);
				return result;
			} finally {
				semaphore.release();
			}
		})();
		inFlight.set(name, promise);
		return promise;
	};

	await Promise.all(agents.map((a) => run(a.name)));
	return results;
}
