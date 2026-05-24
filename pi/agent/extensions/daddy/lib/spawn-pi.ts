// Spawn a child `pi` and collect its stdout lines. Shared by flag + llm node executors.
// stdinInput: when set, the prompt is written to the child's STDIN instead of passed as a
// positional. This is REQUIRED for flag invocations: pi's CLI rejects a positional message
// starting with "--" (verified: `pi -p -- "--hello x"` → "Unknown options"), but the same
// text piped on stdin reaches the input handler and triggers flag interception.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtual = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtual && existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const generic = /^(node|bun)(\.exe)?$/.test(execName);
	return generic ? { command: "pi", args } : { command: process.execPath, args };
}

export interface SpawnResult {
	lines: string[];
	stderr: string;
	code: number | null;
}

export interface SpawnOptions {
	env?: Record<string, string>;
	/** Written to the child's stdin then closed. Use for flag invocations (see file header). */
	stdinInput?: string;
	timeoutMs?: number;
}

/** Run pi with the given args; resolve with parsed-per-line stdout. env merges over process.env. */
export function spawnPi(args: string[], cwd: string, options: SpawnOptions = {}): Promise<SpawnResult> {
	const { env = {}, stdinInput, timeoutMs = 300_000 } = options;
	const { command, args: full } = getPiInvocation(args);
	const stdin = stdinInput === undefined ? "ignore" : "pipe";
	return new Promise((resolve, reject) => {
		const proc = spawn(command, full, { cwd, shell: false, stdio: [stdin, "pipe", "pipe"], env: { ...process.env, ...env } });
		let buffer = "";
		const lines: string[] = [];
		let stderr = "";
		const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
		proc.stdout?.on("data", (c) => {
			buffer += c.toString();
			const parts = buffer.split("\n");
			buffer = parts.pop() ?? "";
			for (const l of parts) lines.push(l);
		});
		proc.stderr?.on("data", (c) => (stderr += c.toString()));
		proc.on("error", (e) => {
			clearTimeout(timer);
			reject(e);
		});
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (buffer.trim()) lines.push(buffer);
			resolve({ lines, stderr, code });
		});
		if (stdinInput !== undefined && proc.stdin) {
			proc.stdin.end(stdinInput);
		}
	});
}
