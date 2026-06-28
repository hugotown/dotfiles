/**
 * Injectable child-process spawn surface.
 *
 * A narrow `SpawnFn` lets exec/pi-child be unit-tested with a fake spawn (no real
 * process). `nodeSpawn` is the production default. `getPiInvocation` reuses the
 * CURRENT pi binary/script (same pattern as the forge extension) so a child pi is
 * launched with the very runtime that is already running, falling back to `pi` on
 * PATH only when it cannot be resolved.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface SpawnChild {
	stdout: { on(event: "data", listener: (chunk: unknown) => void): unknown } | null;
	stderr: { on(event: "data", listener: (chunk: unknown) => void): unknown } | null;
	killed: boolean;
	kill(signal?: string): boolean;
	on(event: "close", listener: (code: number | null) => void): unknown;
	on(event: "error", listener: (err: Error) => void): unknown;
}

export type SpawnFn = (
	command: string,
	args: string[],
	options: { cwd?: string; shell?: boolean; stdio?: Array<"ignore" | "pipe">; signal?: AbortSignal },
) => SpawnChild;

export const nodeSpawn: SpawnFn = (command, args, options) =>
	spawn(command, args, options) as unknown as SpawnChild;

export interface PiInvocationEnv {
	argv1?: string;
	execPath?: string;
	exists?: (p: string) => boolean;
}

/** Resolve how to launch a child pi: prefer the current script/runtime, else `pi`. */
export function getPiInvocation(
	args: string[],
	env: PiInvocationEnv = {},
): { command: string; args: string[] } {
	const currentScript = env.argv1 ?? process.argv[1];
	const execPath = env.execPath ?? process.execPath;
	const exists = env.exists ?? fs.existsSync;
	const isBunVirtual = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtual && exists(currentScript)) {
		return { command: execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) return { command: execPath, args };
	return { command: "pi", args };
}
