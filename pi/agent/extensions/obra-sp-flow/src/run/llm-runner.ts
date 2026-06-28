/**
 * Real `LlmRunner`: wrap a `RunStep` to obtain a contract-valid artifact.
 *
 * Each round asks the child for a single JSON object matching the step template,
 * extracts it tolerantly, and validates it against the contract. On a bad reply it
 * retries with an explicit correction, up to `retries` extra attempts. The executor
 * re-validates the returned payload again — the loop never trusts the child.
 */
import { validateContract } from "../contracts/base.ts";
import type { LlmRoundOptions, LlmRoundResult, LlmRunner, RunStep } from "../types/llm.ts";
import { parseJsonLoose } from "../util/json.ts";

export interface LlmRunnerBase {
	cwd: string;
	signal?: AbortSignal;
	onActivity?: (line: string) => void;
}

function composeTask(opts: LlmRoundOptions, correction?: string): string {
	const lines = [opts.task.trim(), ""];
	if (correction) lines.push(correction, "");
	lines.push(
		"Reply with ONLY a single JSON object matching this template (no prose, no markdown fences):",
		opts.jsonTemplate.trim(),
	);
	return lines.join("\n");
}

export function makeLlmRunner(runStep: RunStep, base: LlmRunnerBase): LlmRunner {
	return {
		async runRound(opts: LlmRoundOptions): Promise<LlmRoundResult> {
			const errors: string[] = [];
			const maxAttempts = Math.max(1, opts.retries + 1);
			let correction: string | undefined;
			let attempts = 0;
			for (attempts = 1; attempts <= maxAttempts; attempts++) {
				const res = await runStep({
					cwd: base.cwd,
					model: opts.model,
					thinkingLevel: opts.thinkingLevel,
					tools: opts.tools,
					skills: opts.skills,
					systemPrompt: opts.system,
					task: composeTask(opts, correction),
					signal: base.signal,
					onActivity: base.onActivity,
				});

				if (res.aborted) {
					errors.push(`attempt ${attempts}: aborted`);
					break;
				}
				if (res.exitCode !== 0) {
					errors.push(`attempt ${attempts}: pi exited ${res.exitCode}${res.stderr ? `: ${res.stderr.slice(0, 300)}` : ""}`);
					correction = undefined;
					continue;
				}

				const payload = parseJsonLoose(res.finalText);
				if (payload == null || typeof payload !== "object") {
					errors.push(`attempt ${attempts}: no JSON object found in reply`);
					correction = "Your previous reply did not contain a JSON object.";
					continue;
				}

				const check = validateContract(opts.contract, payload);
				if (check.ok) return { payload, errors, attempts };
				errors.push(`attempt ${attempts}: contract invalid: ${check.errors.join("; ")}`);
				correction = `Your previous JSON failed validation:\n- ${check.errors.join("\n- ")}`;
			}
			return { payload: null, errors, attempts: Math.min(attempts, maxAttempts) };
		},
	};
}
