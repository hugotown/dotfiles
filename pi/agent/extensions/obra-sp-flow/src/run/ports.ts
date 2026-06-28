/**
 * Runtime ports the executor injects into every RunContext.
 *
 * `realPorts` wires the production exec/llm/feedback (Step C). `placeholderPorts`
 * stays for tests of phases that never reach exec/llm — there it throws on use.
 */
import type { Exec } from "../types/common.ts";
import type { LlmRunner, RunStep } from "../types/llm.ts";
import type { CommandCtx, FeedbackPort } from "../types/ports.ts";
import { makeExec } from "./exec.ts";
import { makeLlmRunner } from "./llm-runner.ts";
import { makePiRunStep } from "./pi-child.ts";
import { nodeSpawn, type SpawnFn } from "./spawn.ts";

export interface RunPorts {
	ctx: CommandCtx;
	exec: Exec;
	llm: LlmRunner;
	feedback: FeedbackPort;
}

/** Live-progress feedback routed to the TUI status line. */
export function uiFeedback(ctx: CommandCtx): FeedbackPort {
	return {
		tick: (line: string) => {
			if (line) ctx.ui.setStatus("obra-sp-flow", line);
		},
	};
}

export interface RealPortDeps {
	spawnImpl?: SpawnFn;
	runStep?: RunStep;
}

/** Production ports: real bash exec + pi-child LLM runner + TUI feedback. */
export function realPorts(ctx: CommandCtx, deps: RealPortDeps = {}): RunPorts {
	const spawnImpl = deps.spawnImpl ?? nodeSpawn;
	const runStep = deps.runStep ?? makePiRunStep(spawnImpl);
	const feedback = uiFeedback(ctx);
	return {
		ctx,
		exec: makeExec(spawnImpl, ctx.cwd),
		feedback,
		llm: makeLlmRunner(runStep, {
			cwd: ctx.cwd,
			signal: ctx.signal,
			onActivity: (line) => feedback.tick(line),
		}),
	};
}

export class PortNotWiredError extends Error {
	constructor(port: string) {
		super(`port '${port}' is not wired yet (pending Step C)`);
		this.name = "PortNotWiredError";
	}
}

/** Placeholder ports until Step C wires real exec/llm. */
export function placeholderPorts(ctx: CommandCtx): RunPorts {
	return {
		ctx,
		feedback: { tick: () => {} },
		exec: async () => {
			throw new PortNotWiredError("exec");
		},
		llm: {
			runRound: async () => {
				throw new PortNotWiredError("llm");
			},
		},
	};
}
