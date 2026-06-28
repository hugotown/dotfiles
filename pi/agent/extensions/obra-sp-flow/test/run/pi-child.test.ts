import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { buildPiArgs, makePiRunStep } from "../../src/run/pi-child.ts";
import type { SpawnChild, SpawnFn } from "../../src/run/spawn.ts";
import type { LlmStepOptions } from "../../src/types/llm.ts";

const BASE: LlmStepOptions = { cwd: "/tmp", systemPrompt: "", task: "do it" };

interface FakeOpts {
	stdout?: string;
	stderr?: string;
	code?: number | null;
	error?: Error;
	throwSync?: boolean;
}

function makeFake(opts: FakeOpts) {
	const calls: Array<{ command: string; args: string[] }> = [];
	const fn: SpawnFn = (command, args) => {
		calls.push({ command, args });
		if (opts.throwSync) throw new Error("spawn boom");
		const stdout = new EventEmitter();
		const stderr = new EventEmitter();
		const proc = new EventEmitter() as EventEmitter & SpawnChild;
		(proc as { stdout: unknown }).stdout = stdout;
		(proc as { stderr: unknown }).stderr = stderr;
		proc.killed = false;
		proc.kill = () => true;
		setImmediate(() => {
			if (opts.stderr) stderr.emit("data", Buffer.from(opts.stderr));
			if (opts.stdout) stdout.emit("data", Buffer.from(opts.stdout));
			if (opts.error) proc.emit("error", opts.error);
			else proc.emit("close", opts.code ?? 0);
		});
		return proc;
	};
	return { fn, calls };
}

describe("buildPiArgs", () => {
	it("combines model + thinking, tools, non-empty skills and the system file", () => {
		const args = buildPiArgs(
			{ ...BASE, model: "m", thinkingLevel: "high", tools: "read,bash", skills: ["s1", "", "s2"] },
			"/tmp/system.md",
		);
		expect(args.slice(0, 4)).toEqual(["--mode", "json", "-p", "--no-session"]);
		expect(args).toContain("--model");
		expect(args[args.indexOf("--model") + 1]).toBe("m:high");
		expect(args[args.indexOf("--tools") + 1]).toBe("read,bash");
		expect(args.filter((a) => a === "--skill").length).toBe(2);
		expect(args[args.indexOf("--append-system-prompt") + 1]).toBe("/tmp/system.md");
		expect(args[args.length - 1]).toBe("Task: do it");
	});

	it("uses the bare model when no thinking level is set", () => {
		const args = buildPiArgs({ ...BASE, model: "m" });
		expect(args[args.indexOf("--model") + 1]).toBe("m");
	});

	it("falls back to --thinking when no model is set", () => {
		const args = buildPiArgs({ ...BASE, thinkingLevel: "low" });
		expect(args).not.toContain("--model");
		expect(args[args.indexOf("--thinking") + 1]).toBe("low");
	});

	it("emits only the minimal args when nothing optional is set", () => {
		expect(buildPiArgs(BASE)).toEqual(["--mode", "json", "-p", "--no-session", "Task: do it"]);
	});
});

describe("makePiRunStep", () => {
	it("parses the JSON stream, ticks activity, and cleans the temp prompt", async () => {
		const ticks: string[] = [];
		const jsonl = [
			'{"type":"turn_start"}',
			'{"type":"message_end","message":{"role":"assistant","content":[{"type":"toolCall","name":"bash","arguments":{"command":"echo a very long command line that exceeds the fifty character limit"}}]}}',
			'{"type":"message_end","message":{"role":"assistant","content":[{"type":"toolCall","name":"read"}]}}',
			'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"hi"}],"stopReason":"stop"}}',
			'{"type":"message_end","message":{"role":"assistant"}}',
			'{"type":"agent_end","messages":[{"role":"user","content":[{"type":"text","text":"q"}]},{"role":"assistant","content":[{"type":"text","text":"FINAL"}],"stopReason":"stop"}]}',
		].join("\n");
		const { fn, calls } = makeFake({ stdout: `${jsonl}\n`, code: 0 });

		const res = await makePiRunStep(fn)({
			cwd: "/tmp",
			model: "m",
			thinkingLevel: "high",
			tools: "read",
			skills: ["s1", "", "s2"],
			systemPrompt: "you are a reviewer",
			task: "review",
			onActivity: (l) => ticks.push(l),
		});

		expect(res.exitCode).toBe(0);
		expect(res.finalText).toBe("FINAL");
		expect(res.stopReason).toBe("stop");
		expect(res.errorMessage).toBeUndefined();
		expect(res.aborted).toBe(false);

		expect(ticks.length).toBe(3);
		expect(ticks[0]).toStartWith("· bash");
		expect(ticks[0]).toEndWith("…");
		expect(ticks[1]).toBe("· read {}");

		const args = calls[0].args;
		const promptPath = args[args.indexOf("--append-system-prompt") + 1];
		expect(promptPath).toBeDefined();
		expect(fs.existsSync(promptPath)).toBe(false); // cleaned in finally
	});

	it("captures errorMessage + nonzero exit and skips the temp file with no system prompt", async () => {
		const jsonl =
			'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"partial answer"}],"stopReason":"error","errorMessage":"model failed"}}';
		const { fn, calls } = makeFake({ stdout: `${jsonl}\n`, stderr: "pi warning", code: 2 });

		const res = await makePiRunStep(fn)({ cwd: "/tmp", systemPrompt: "", task: "t" });

		expect(res.exitCode).toBe(2);
		expect(res.stopReason).toBe("error");
		expect(res.errorMessage).toBe("model failed");
		expect(res.finalText).toBe("partial answer");
		expect(res.stderr).toContain("pi warning");
		expect(calls[0].args).not.toContain("--append-system-prompt");
	});

	it("resolves exit 1 when spawn throws synchronously", async () => {
		const { fn } = makeFake({ throwSync: true });
		const res = await makePiRunStep(fn)({ cwd: "/tmp", systemPrompt: "", task: "t" });
		expect(res.exitCode).toBe(1);
		expect(res.stderr).toContain("spawn boom");
	});

	it("flags aborted on an error event when the signal is aborted", async () => {
		const { fn } = makeFake({ error: new Error("killed") });
		const res = await makePiRunStep(fn)({
			cwd: "/tmp",
			systemPrompt: "",
			task: "t",
			signal: AbortSignal.abort(),
		});
		expect(res.exitCode).toBe(1);
		expect(res.aborted).toBe(true);
	});

	it("records stderr on a non-abort error event", async () => {
		const { fn } = makeFake({ error: new Error("network down") });
		const res = await makePiRunStep(fn)({ cwd: "/tmp", systemPrompt: "", task: "t" });
		expect(res.exitCode).toBe(1);
		expect(res.aborted).toBe(false);
		expect(res.stderr).toContain("network down");
	});

	it("skips blank/invalid lines and flushes a trailing partial line at close (code null)", async () => {
		const tail =
			'{"type":"agent_end","messages":[{"role":"assistant","content":[{"type":"text","text":"tail"}],"stopReason":"stop"}]}';
		const { fn } = makeFake({ stdout: `\ngarbage line\n${tail}`, code: null });
		const res = await makePiRunStep(fn)({ cwd: "/tmp", systemPrompt: "", task: "t" });
		expect(res.exitCode).toBe(0);
		expect(res.finalText).toBe("tail");
	});
});
