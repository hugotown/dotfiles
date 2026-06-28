/** Run state persisted to state.json. */
import type { PhaseKind, PhaseStatus, RunStatus, Verdict } from "./common.ts";

export interface PhaseState {
	id: string;
	index: number;
	group: number; // canonical milestone 0..6 (maps to the NN-*.json artifact)
	kind: PhaseKind;
	status: PhaseStatus;
	attempts: number;
	startedAt?: string;
	endedAt?: string;
	durationMs?: number;
	model?: string;
	artifact?: string; // path relative to runDir
	verdict?: Verdict;
	blockers?: string[];
	error?: string;
}

export interface ObraState {
	version: number;
	runId: string;
	slug: string;
	request: string;
	parentSessionFile: string | null;
	createdAt: string;
	updatedAt: string;
	status: RunStatus;
	currentPhaseId: string | null;
	approval: { required: boolean; granted: boolean; grantedAt?: string };
	phases: Record<string, PhaseState>;
	timing: { startedAt: string; endedAt?: string; totalMs?: number };
}

/** Metadata stamped on every artifact (not produced by the LLM). */
export interface ArtifactMeta {
	phase: string;
	index: number;
	kind: PhaseKind;
	attempt: number;
	startedAt: string;
	endedAt: string;
	durationMs: number;
	model?: string;
}
