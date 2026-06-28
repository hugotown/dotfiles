/**
 * Real `RunStep`: run one isolated, clean-context pi child and return its final text.
 *
 *   pi --mode json -p --no-session [--model M[:thinking]] [--tools T]
 *      [--skill S]... [--append-system-prompt FILE] "Task: ..."
 *
 * The JSON event stream is parsed line-by-line for live activity and to recover the
 * final assistant text (preferring the message whose stopReason is "stop"). The
 * caller validates that text against a contract — this step never trusts it.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { LlmStepOptions, LlmStepResult, RunStep } from "../types/llm.ts";
import { getPiInvocation, type SpawnChild, type SpawnFn } from "./spawn.ts";

function shorten(s: string, n: number): string {
	const one = s.replace(/\s+/g, " ").trim();
	return one.length > n ? `${one.slice(0, n)}…` : one;
}

/** Turn an assistant `message_end` event into a one-line activity tick. */
function formatActivity(event: { type?: string; message?: { role?: string; content?: unknown[] } }): string | null {
	if (event?.type === "message_end" && event.message?.role === "assistant") {
		for (const part of (event.message.content ?? []) as Array<{
			type?: string;
			name?: string;
			arguments?: unknown;
			text?: string;
		}>) {
			if (part.type === "toolCall") return `· ${part.name} ${shorten(JSON.stringify(part.arguments ?? {}), 50)}`;
			if (part.type === "text" && part.text?.trim()) return `· ${shorten(part.text, 70)}`;
		}
	}
	return null;
}

function assistantText(message: { role?: string; content?: unknown[] }): string {
	if (message?.role !== "assistant") return "";
	return ((message.content ?? []) as Array<{ type?: string; text?: string }>)
		.filter((p) => p.type === "text" && p.text)
		.map((p) => p.text as string)
		.join("\n")
		.trim();
}

/** Compose the pi CLI argv for a step (exported for unit testing). */
export function buildPiArgs(opts: LlmStepOptions, systemPromptFile?: string): string[] {
	const args = ["--mode", "json", "-p", "--no-session"];
	const modelArg = opts.model ? (opts.thinkingLevel ? `${opts.model}:${opts.thinkingLevel}` : opts.model) : "";
	if (modelArg) args.push("--model", modelArg);
	else if (opts.thinkingLevel) args.push("--thinking", opts.thinkingLevel);
	if (opts.tools) args.push("--tools", opts.tools);
	for (const skill of opts.skills ?? []) {
		if (skill) args.push("--skill", skill);
	}
	if (systemPromptFile) args.push("--append-system-prompt", systemPromptFile);
	args.push(`Task: ${opts.task}`);
	return args;
}

/** Build a `RunStep` bound to a spawn implementation. */
export function makePiRunStep(spawnImpl: SpawnFn): RunStep {
	return async (opts: LlmStepOptions): Promise<LlmStepResult> => {
		const result: LlmStepResult = { exitCode: 0, stderr: "", finalText: "", aborted: false };
		let promptDir: string | null = null;
		let promptFile: string | null = null;
		let lastText = "";
		let stopText = "";
		try {
			if (opts.systemPrompt.trim()) {
				promptDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "obra-prompt-"));
				promptFile = path.join(promptDir, "system.md");
				await fs.promises.writeFile(promptFile, opts.systemPrompt, { encoding: "utf-8", mode: 0o600 });
			}
			const inv = getPiInvocation(buildPiArgs(opts, promptFile ?? undefined));

			result.exitCode = await new Promise<number>((resolve) => {
				let proc: SpawnChild;
				try {
					proc = spawnImpl(inv.command, inv.args, {
						cwd: opts.cwd,
						shell: false,
						stdio: ["ignore", "pipe", "pipe"],
						signal: opts.signal,
					});
				} catch (err) {
					result.stderr += String(err);
					resolve(1);
					return;
				}

				let buffer = "";
				const onLine = (line: string): void => {
					if (!line.trim()) return;
					let event: {
						type?: string;
						message?: { role?: string; content?: unknown[]; stopReason?: string; errorMessage?: string };
						messages?: Array<{ role?: string; content?: unknown[]; stopReason?: string }>;
					};
					try {
						event = JSON.parse(line);
					} catch {
						return;
					}
					const act = formatActivity(event);
					if (act && opts.onActivity) opts.onActivity(act);
					if (event?.type === "message_end" && event.message?.role === "assistant") {
						if (event.message.stopReason) result.stopReason = event.message.stopReason;
						if (event.message.errorMessage) result.errorMessage = event.message.errorMessage;
						const txt = assistantText(event.message);
						if (txt) lastText = txt;
						if (event.message.stopReason === "stop" && txt) stopText = txt;
					} else if (event?.type === "agent_end") {
						for (const message of event.messages ?? []) {
							const txt = assistantText(message);
							if (txt) lastText = txt;
							if (message.stopReason === "stop" && txt) stopText = txt;
						}
					}
				};

				proc.stdout?.on("data", (d) => {
					buffer += String(d);
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const l of lines) onLine(l);
				});
				proc.stderr?.on("data", (d) => {
					result.stderr += String(d);
				});
				proc.on("close", (code) => {
					if (buffer.trim()) onLine(buffer);
					resolve(code ?? 0);
				});
				proc.on("error", (err) => {
					if (opts.signal?.aborted) result.aborted = true;
					else result.stderr += `\n${String(err)}`;
					resolve(1);
				});
			});

			result.finalText = stopText || lastText;
			return result;
		} finally {
			if (promptDir) fs.rmSync(promptDir, { recursive: true, force: true });
		}
	};
}
