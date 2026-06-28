import type { ObraState, PhaseState } from "../types/state.ts";
import type { PhaseSeed } from "../run/phase-plan.ts";

export interface CreateStateInput {
	runId: string;
	slug: string;
	request: string;
	parentSessionFile: string | null;
	createdAt: string;
	phases: PhaseSeed[];
}

function initialPhase(seed: PhaseSeed): PhaseState {
	return {
		id: seed.id,
		index: seed.index,
		group: seed.group,
		kind: seed.kind,
		status: "pending",
		attempts: 0,
	};
}

export function createInitialState(input: CreateStateInput): ObraState {
	const phaseEntries = input.phases.map((p) => [p.id, initialPhase(p)]);
	return {
		version: 1,
		runId: input.runId,
		slug: input.slug,
		request: input.request,
		parentSessionFile: input.parentSessionFile,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		status: "running",
		currentPhaseId: input.phases[0]?.id ?? null,
		approval: { required: true, granted: false },
		phases: Object.fromEntries(phaseEntries),
		timing: { startedAt: input.createdAt },
	};
}
