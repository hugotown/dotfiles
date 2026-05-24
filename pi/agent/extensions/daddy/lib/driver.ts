// Re-entrant wave driver (design §9). partitionReady is pure & tested; continueRun
// performs the I/O and is verified manually. AI-ask is a wave barrier: it never shares
// a wave with subprocess nodes and at most one runs per suspension (design §9.2).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WAVE_CONCURRENCY } from "../constants.ts";
import { allNodes } from "./flat-nodes.ts";
import { createSemaphore } from "./semaphore.ts";
import { delegateAsk } from "./delegate-ask.ts";
import { runSelfContained } from "./run-node.ts";
import { markRunning, mergeNodeResult, persistState } from "./state-store.ts";
import type { NodeState, StateMachine } from "../types.ts";

export interface Partition {
	toSkip: NodeState[];
	subprocess: NodeState[];
	aiAsk: NodeState[];
	done: boolean;
}

const isAiAsk = (n: NodeState): boolean => n.action === "ask" && n.aiAssisted === true;

/** Pure: classify pending nodes by readiness for the next wave. */
export function partitionReady(state: StateMachine): Partition {
	const nodes = allNodes(state);
	const status = new Map(nodes.map((n) => [n.id, n.status] as const));
	const pending = nodes.filter((n) => n.status === "pending");
	const toSkip = pending.filter((n) => n.depends_on.some((d) => status.get(d) === "failed" || status.get(d) === "skipped"));
	const ready = pending.filter((n) => !toSkip.includes(n) && n.depends_on.every((d) => status.get(d) === "ok"));
	return {
		toSkip,
		subprocess: ready.filter((n) => !isAiAsk(n)),
		aiAsk: ready.filter(isAiAsk),
		done: pending.length === 0,
	};
}

/**
 * Drive the run forward. Called from the input handler AND from agent_end (re-entrant).
 * Returns when the run completes OR when it suspends for an AI-ask delegation.
 */
export async function continueRun(pi: ExtensionAPI, ctx: ExtensionContext, state: StateMachine, file: string): Promise<void> {
	const semaphore = createSemaphore(WAVE_CONCURRENCY);
	// biome-ignore lint/correctness/noConstantCondition: loop exits via return.
	while (true) {
		const { toSkip, subprocess, aiAsk, done } = partitionReady(state);
		if (done) return;

		for (const n of toSkip) {
			n.status = "skipped";
			n.endedAt = new Date().toISOString();
		}
		if (toSkip.length) await persistState(file, state);

		if (subprocess.length) {
			await Promise.all(
				subprocess.map(async (node) => {
					markRunning(state, node.id);
					await semaphore.acquire();
					try {
						const result = await runSelfContained(pi, ctx, node, state);
						mergeNodeResult(state, node.id, result);
					} finally {
						semaphore.release();
					}
					await persistState(file, state);
				}),
			);
			continue;
		}

		if (aiAsk.length) {
			const node = aiAsk.sort((a, b) => a.id.localeCompare(b.id))[0]; // deterministic id order
			markRunning(state, node.id);
			await persistState(file, state);
			delegateAsk(pi, node, state); // triggers a main-agent turn, then we SUSPEND
			return;
		}
		return; // ready empty but pending non-empty → nothing runnable (shouldn't happen post-validation)
	}
}
