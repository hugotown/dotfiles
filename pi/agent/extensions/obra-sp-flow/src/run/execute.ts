/**
 * Minimal phase executor.
 *
 * Iterates the canonical PHASE_PLAN, runs each step, validates its payload against
 * the step contract, persists the artifact (atomic) and advances state.json. The
 * control flow is deterministic; the loop never trusts an LLM (it re-validates).
 *
 * Stop conditions:
 *  - a step has no registered Phase           -> state.status = "blocked"
 *  - a step throws                             -> state.status = "failed"
 *  - a step payload fails its contract         -> state.status = "blocked"
 *  - a step returns verdict "block"            -> state.status = "blocked"
 *  - a gate step runs but is not granted       -> state.status = "awaiting-approval" (paused)
 *  - all steps pass                            -> state.status = "completed"
 */
import * as path from "node:path";
import { stepConfig } from "../config/step.ts";
import { validateContract } from "../contracts/base.ts";
import { artifactRelForSeed } from "../paths/artifact-name.ts";
import type { PhaseStatus, RunStatus, Verdict } from "../types/common.ts";
import type { ObraConfig, StepConfig } from "../types/config.ts";
import type { Phase, RunContext } from "../types/phase.ts";
import type { ArtifactMeta, ObraState, PhaseState } from "../types/state.ts";
import { readJson, writeAtomicJson } from "../util/fs-atomic.ts";
import { PHASE_PLAN, type PhaseSeed } from "./phase-plan.ts";
import type { PhaseRegistry } from "./phase-registry.ts";
import type { RunPorts } from "./ports.ts";

export interface ExecuteInput {
	statePath: string;
	runDir: string;
	artifactsDir: string;
	config: ObraConfig;
	ports: RunPorts;
	registry: PhaseRegistry;
	plan?: PhaseSeed[];
	now?: () => string;
	signal?: AbortSignal;
}

export type ExecuteResult =
	| { kind: "complete" }
	| { kind: "paused"; phaseId: string }
	| { kind: "blocked"; phaseId: string; errors: string[] };

function nextPendingId(plan: PhaseSeed[], state: ObraState): string | null {
	for (const seed of plan) {
		if (state.phases[seed.id]?.status !== "passed") return seed.id;
	}
	return null;
}

async function runPhase(
	phase: Phase,
	rc: RunContext,
	sc: StepConfig,
	retries: number,
): Promise<Record<string, unknown>> {
	if (phase.kind === "llm") {
		if (!phase.buildPrompt) throw new Error(`llm phase '${phase.id}' has no buildPrompt()`);
		const prompt = phase.buildPrompt(rc);
		const round = await rc.llm.runRound({
			system: prompt.system,
			task: prompt.task,
			jsonTemplate: prompt.jsonTemplate,
			contract: phase.contract,
			model: sc.model || undefined,
			thinkingLevel: sc.thinkingLevel || undefined,
			tools: sc.tools,
			skills: sc.skills,
			retries,
			label: phase.id,
		});
		if (!round.payload) throw new Error(`llm round failed: ${round.errors.join("; ")}`);
		return round.payload as Record<string, unknown>;
	}
	if (!phase.run) throw new Error(`phase '${phase.id}' has no run()`);
	return phase.run(rc);
}

export async function executeRun(input: ExecuteInput): Promise<ExecuteResult> {
	const plan = input.plan ?? PHASE_PLAN;
	const now = input.now ?? (() => new Date().toISOString());
	const state = readJson<ObraState>(input.statePath);
	if (!state) throw new Error(`state.json not found at ${input.statePath}`);

	const persist = (): void => {
		state.updatedAt = now();
		writeAtomicJson(input.statePath, state);
	};

	const readArtifact = (phaseId: string): unknown => {
		const seed = plan.find((s) => s.id === phaseId);
		if (!seed) return null;
		const rel = artifactRelForSeed(seed);
		return rel ? readJson(path.join(input.runDir, rel)) : null;
	};

	const stop = (
		ps: PhaseState,
		phaseStatus: PhaseStatus,
		runStatus: RunStatus,
		message: string,
		startedAt?: string,
	): ExecuteResult => {
		if (startedAt) {
			ps.endedAt = now();
			ps.durationMs = Date.parse(ps.endedAt) - Date.parse(startedAt);
		}
		ps.status = phaseStatus;
		ps.error = message;
		state.status = runStatus;
		state.currentPhaseId = ps.id;
		persist();
		return { kind: "blocked", phaseId: ps.id, errors: [message] };
	};

	for (const seed of plan) {
		const ps = state.phases[seed.id];
		if (!ps) continue;
		if (ps.status === "passed") continue; // idempotent resume

		state.currentPhaseId = seed.id;
		const phase = input.registry[seed.id];
		if (!phase) {
			return stop(ps, "blocked", "blocked", `phase '${seed.id}' not implemented yet`);
		}

		const rc: RunContext = {
			exec: input.ports.exec,
			ctx: input.ports.ctx,
			cwd: input.ports.ctx.cwd,
			config: input.config,
			runDir: input.runDir,
			artifactsDir: input.artifactsDir,
			state,
			feedback: input.ports.feedback,
			llm: input.ports.llm,
			now,
			signal: input.signal,
			readArtifact,
		};

		if (phase.shouldRun && !phase.shouldRun(rc)) {
			ps.status = "passed";
			ps.verdict = "pass";
			persist();
			continue;
		}

		const startedAt = now();
		ps.status = "running";
		ps.startedAt = startedAt;
		ps.attempts += 1;
		const sc = stepConfig(input.config, seed.id);
		ps.model = sc.model || undefined;
		persist();

		let payload: Record<string, unknown>;
		try {
			payload = await runPhase(phase, rc, sc, input.config.defaults.llmRetries);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return stop(ps, "failed", "failed", msg, startedAt);
		}

		const check = validateContract(phase.contract, payload);
		if (!check.ok) {
			return stop(ps, "blocked", "blocked", `contract invalid: ${check.errors.join("; ")}`, startedAt);
		}

		const endedAt = now();
		const verdict = (payload.verdict as Verdict) ?? "pass";

		const rel = artifactRelForSeed(seed);
		if (rel) {
			const meta: ArtifactMeta = {
				phase: seed.id,
				index: seed.index,
				kind: seed.kind,
				attempt: ps.attempts,
				startedAt,
				endedAt,
				durationMs: Date.parse(endedAt) - Date.parse(startedAt),
				model: sc.model || undefined,
			};
			writeAtomicJson(path.join(input.runDir, rel), { ...payload, _meta: meta });
			ps.artifact = rel;
		}

		ps.endedAt = endedAt;
		ps.durationMs = Date.parse(endedAt) - Date.parse(startedAt);
		ps.verdict = verdict;

		if (verdict === "block") {
			ps.status = "blocked";
			ps.blockers = Array.isArray(payload.blockers) ? (payload.blockers as string[]) : undefined;
			state.status = "blocked";
			persist();
			return { kind: "blocked", phaseId: seed.id, errors: ps.blockers ?? [] };
		}

		ps.status = "passed";

		if (seed.kind === "gate") {
			const granted = payload.granted === true;
			state.approval.granted = granted;
			if (granted) {
				state.approval.grantedAt = endedAt;
			} else {
				// Not granted: keep the gate re-evaluable on resume (don't leave it "passed").
				ps.status = "pending";
				state.status = "awaiting-approval";
				state.currentPhaseId = seed.id;
				persist();
				return { kind: "paused", phaseId: seed.id };
			}
		}

		state.currentPhaseId = nextPendingId(plan, state);
		persist();
	}

	state.status = "completed";
	state.currentPhaseId = null;
	state.timing.endedAt = now();
	state.timing.totalMs = Date.parse(state.timing.endedAt) - Date.parse(state.timing.startedAt);
	persist();
	return { kind: "complete" };
}
