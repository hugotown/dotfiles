/** Shared enums/literals. */
export type PhaseKind = "deterministic" | "llm" | "gate" | "orchestrated";
export type Verdict = "pass" | "block";
export type PhaseStatus = "pending" | "running" | "passed" | "blocked" | "failed";
export type RunStatus =
	| "running"
	| "awaiting-approval"
	| "approved"
	| "completed"
	| "blocked"
	| "failed";

export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number | null;
	killed?: boolean;
}

export type Exec = (
	command: string,
	args: string[],
	opts?: { signal?: AbortSignal; timeout?: number },
) => Promise<ExecResult>;
