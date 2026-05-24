// How to spawn a child `pi`, what flags to pass, and where to stage the system prompt.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { DEFAULT_BLOCKED_TOOLS } from "../constants.ts";
import type { AgentSpec } from "../types.ts";

/** Decide how to spawn pi: the running script, the bundled binary, or `pi` on PATH. */
export function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	return isGenericRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

/**
 * Base CLI flags from the spec. pi has no block flag, so a blocklist is enforced by
 * passing an allowlist of (toolUniverse − blocked). `ask_user_question` is always blocked.
 */
export function baseArgs(spec: AgentSpec, toolUniverse: string[]): string[] {
	const args = ["--mode", "json", "-p", "--no-session", "--provider", spec.provider, "--model", spec.model, "--thinking", spec.variant];
	const blocked = new Set([...DEFAULT_BLOCKED_TOOLS, ...(spec.blockedTools ?? [])]);
	const allowed = toolUniverse.filter((name) => !blocked.has(name));
	if (toolUniverse.length > 0) args.push("--tools", allowed.join(","));
	return args;
}

/** Stage the agent's instructions as a 0600 temp file for --append-system-prompt. */
export async function writeSystemPrompt(name: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safe = name.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(dir, `system-${safe}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	});
	return { dir, filePath };
}

export function cleanupTemp(dir: string | null, filePath: string | null): void {
	if (filePath) {
		try {
			fs.unlinkSync(filePath);
		} catch {
			/* ignore */
		}
	}
	if (dir) {
		try {
			fs.rmdirSync(dir);
		} catch {
			/* ignore */
		}
	}
}
