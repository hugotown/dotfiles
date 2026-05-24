// Runs one subagent as an isolated `pi` subprocess, streaming its messages back.
import { spawn } from "node:child_process";
import { type AgentResult, emptyResult } from "../result.ts";
import { applyJsonLine } from "./json-stream.ts";
import { baseArgs, cleanupTemp, getPiInvocation, writeSystemPrompt } from "./pi-invocation.ts";
import { buildSystemPrompt, buildTask } from "./prompt.ts";
import type { AgentSpec } from "../types.ts";

export interface RunnerCallbacks {
	/** Called on every streamed message and at completion, with the mutated result. */
	onPartial?: (result: AgentResult) => void;
}

function streamProcess(command: string, args: string[], cwd: string, signal: AbortSignal | undefined, result: AgentResult, emit: () => void): Promise<{ exitCode: number; aborted: boolean }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
		let buffer = "";
		let aborted = false;
		const onLine = (line: string) => {
			if (applyJsonLine(result, line)) emit();
		};
		proc.stdout.on("data", (data) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) onLine(line);
		});
		proc.stderr.on("data", (data) => {
			result.stderr += data.toString();
		});
		proc.on("close", (code) => {
			if (buffer.trim()) onLine(buffer);
			resolve({ exitCode: code ?? 0, aborted });
		});
		proc.on("error", () => resolve({ exitCode: 1, aborted }));
		if (signal) {
			const kill = () => {
				aborted = true;
				proc.kill("SIGTERM");
				setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 5000);
			};
			signal.aborted ? kill() : signal.addEventListener("abort", kill, { once: true });
		}
	});
}

export async function runAgentProcess(spec: AgentSpec, deps: AgentResult[], toolUniverse: string[], cwd: string, signal: AbortSignal | undefined, callbacks: RunnerCallbacks): Promise<AgentResult> {
	const result = emptyResult(spec, "running", buildTask(spec, deps));
	const emit = () => callbacks.onPartial?.(result);
	emit();
	let dir: string | null = null;
	let filePath: string | null = null;
	try {
		const sys = await writeSystemPrompt(spec.name, buildSystemPrompt(spec));
		dir = sys.dir;
		filePath = sys.filePath;
		const args = [...baseArgs(spec, toolUniverse), "--append-system-prompt", filePath, result.task];
		const { command, args: cmdArgs } = getPiInvocation(args);
		const { exitCode, aborted } = await streamProcess(command, cmdArgs, cwd, signal, result, emit);

		result.exitCode = exitCode;
		const ok = exitCode === 0 && result.stopReason !== "error" && result.stopReason !== "aborted" && !aborted;
		result.status = ok ? "ok" : "failed";
		if (aborted && !result.errorMessage) result.errorMessage = "Aborted";
		emit();
		return result;
	} finally {
		cleanupTemp(dir, filePath);
	}
}
