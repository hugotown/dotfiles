/** Phase + run-context contracts. */
import type { TSchema } from "@sinclair/typebox";
import type { Exec, PhaseKind } from "./common.ts";
import type { ObraConfig } from "./config.ts";
import type { LlmRunner } from "./llm.ts";
import type { CommandCtx, FeedbackPort } from "./ports.ts";
import type { ObraState } from "./state.ts";

export interface LlmPrompt {
	system: string;
	task: string;
	jsonTemplate: string;
}

/** Context handed to every phase. */
export interface RunContext {
	exec: Exec;
	ctx: CommandCtx;
	cwd: string;
	config: ObraConfig;
	runDir: string;
	artifactsDir: string;
	state: ObraState;
	feedback: FeedbackPort;
	llm: LlmRunner;
	now: () => string;
	signal?: AbortSignal;
	readArtifact: (phaseId: string) => any | null;
}

export interface Phase {
	id: string;
	index: number;
	title: string;
	kind: PhaseKind;
	inputs?: string[];
	tools?: string[];
	contract: TSchema;
	shouldRun?: (rc: RunContext) => boolean;
	/** Deterministic/gate/orchestrated phases produce the artifact payload. */
	run?: (rc: RunContext) => Promise<Record<string, unknown>>;
	/** Pure LLM phases build the child prompt. */
	buildPrompt?: (rc: RunContext) => LlmPrompt;
}
