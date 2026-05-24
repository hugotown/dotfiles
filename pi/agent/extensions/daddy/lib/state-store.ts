// Build / merge / atomically persist / load / resume the run state machine (design §12).
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { allNodes, findNode } from "./flat-nodes.ts";
import type { NodeResult, NodeState, StateMachine, Workflow } from "../types.ts";

export function buildState(wf: Workflow, args: string, pid: number): StateMachine {
	const now = new Date().toISOString();
	return {
		workflow: wf.name,
		arguments: args,
		startedAt: now,
		pid,
		heartbeat: now,
		vsm: wf.vsm.map((chain) => ({
			sipoc: chain.sipoc,
			nodes: chain.nodes.map((n): NodeState => ({ ...n, status: "pending" })),
		})),
	};
}

/** Apply a node executor's result in place and stamp endedAt. Returns the same state. */
export function mergeNodeResult(state: StateMachine, id: string, result: NodeResult): StateMachine {
	const node = findNode(state, id);
	if (!node) throw new Error(`mergeNodeResult: unknown node ${id}`);
	node.status = result.status;
	node.output = result.output;
	node.structured = result.structured;
	node.endedAt = new Date().toISOString();
	state.heartbeat = node.endedAt;
	return state;
}

/** Mark a node running (start timestamp + heartbeat). */
export function markRunning(state: StateMachine, id: string): StateMachine {
	const node = findNode(state, id);
	if (node) {
		node.status = "running";
		node.startedAt = new Date().toISOString();
		state.heartbeat = node.startedAt;
	}
	return state;
}

/** Resume policy: keep ok; reset running AND failed to pending (design §12.2). */
export function resumeState(state: StateMachine): StateMachine {
	for (const node of allNodes(state)) {
		if (node.status === "running" || node.status === "failed") {
			node.status = "pending";
			node.output = undefined;
			node.structured = undefined;
		}
	}
	return state;
}

/** Atomic write: unique tmp + rename so a SIGKILL mid-write never truncates the real file,
 * and concurrent persists within a wave never collide on a shared tmp path (each wins or
 * loses the rename atomically; the last rename leaves a valid, complete state). */
export async function persistState(file: string, state: StateMachine): Promise<void> {
	const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
	await fs.rename(tmp, file);
}

export async function loadState(file: string): Promise<StateMachine | null> {
	try {
		return JSON.parse(await fs.readFile(file, "utf-8")) as StateMachine;
	} catch {
		return null;
	}
}
