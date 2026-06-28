/** LLM runner abstractions (DIP: phases depend on the interface, not the process). */
import type { TSchema } from "@sinclair/typebox";

export interface LlmStepResult {
	exitCode: number;
	stderr: string;
	stopReason?: string;
	errorMessage?: string;
	finalText: string;
	aborted: boolean;
}

export interface LlmStepOptions {
	cwd: string;
	model?: string;
	thinkingLevel?: string;
	tools?: string;
	skills?: string[];
	systemPrompt: string;
	task: string;
	signal?: AbortSignal;
	onActivity?: (line: string) => void;
}

/** Runs a single isolated, clean-context pi child and returns its final text. */
export type RunStep = (opts: LlmStepOptions) => Promise<LlmStepResult>;

export interface LlmRoundOptions {
	system: string;
	task: string;
	jsonTemplate: string;
	contract: TSchema;
	model?: string;
	thinkingLevel?: string;
	tools: string;
	skills?: string[];
	retries: number;
	label?: string;
}

export interface LlmRoundResult {
	payload: any | null;
	errors: string[];
	attempts: number;
}

/** Validate JSON against a contract -> readable errors. */
export type Validate = (schema: TSchema, payload: unknown) => { ok: boolean; errors: string[] };

/** High-level port phases use to obtain a contract-valid artifact. */
export interface LlmRunner {
	runRound(opts: LlmRoundOptions): Promise<LlmRoundResult>;
}
