import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "bun:test";
import { loose } from "../../src/contracts/base.ts";
import { makeLlmRunner } from "../../src/run/llm-runner.ts";
import type { LlmRoundOptions, LlmStepOptions, LlmStepResult, RunStep } from "../../src/types/llm.ts";

const CONTRACT = loose({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("block")]) });

function step(partial: Partial<LlmStepResult>): LlmStepResult {
	return { exitCode: 0, stderr: "", finalText: "", aborted: false, ...partial };
}

function fakeRunStep(queue: LlmStepResult[]) {
	const calls: LlmStepOptions[] = [];
	let i = 0;
	const runStep: RunStep = async (opts) => {
		calls.push(opts);
		return queue[Math.min(i++, queue.length - 1)];
	};
	return { runStep, calls };
}

function round(over: Partial<LlmRoundOptions> = {}): LlmRoundOptions {
	return {
		system: "SYS",
		task: "build it",
		jsonTemplate: '{"verdict":"pass"}',
		contract: CONTRACT,
		tools: "read,bash",
		retries: 2,
		...over,
	};
}

describe("makeLlmRunner", () => {
	it("returns the payload on the first valid reply and forwards step options", async () => {
		const { runStep, calls } = fakeRunStep([step({ finalText: '{"verdict":"pass"}' })]);
		const onActivity = () => {};
		const runner = makeLlmRunner(runStep, { cwd: "/work", signal: undefined, onActivity });

		const res = await runner.runRound(round({ model: "m", thinkingLevel: "high", skills: ["s"] }));

		expect(res.payload).toEqual({ verdict: "pass" });
		expect(res.attempts).toBe(1);
		expect(res.errors).toEqual([]);
		expect(calls[0].cwd).toBe("/work");
		expect(calls[0].model).toBe("m");
		expect(calls[0].tools).toBe("read,bash");
		expect(calls[0].onActivity).toBe(onActivity);
		expect(calls[0].task).not.toContain("did not contain");
	});

	it("retries with a correction after a reply with no JSON object", async () => {
		const { runStep, calls } = fakeRunStep([
			step({ finalText: "no json here" }),
			step({ finalText: '{"verdict":"pass"}' }),
		]);
		const runner = makeLlmRunner(runStep, { cwd: "/work" });
		const res = await runner.runRound(round());
		expect(res.payload).toEqual({ verdict: "pass" });
		expect(res.attempts).toBe(2);
		expect(calls[1].task).toContain("did not contain a JSON object");
	});

	it("retries with a validation correction after a contract failure", async () => {
		const { runStep, calls } = fakeRunStep([
			step({ finalText: '{"foo":1}' }),
			step({ finalText: '{"verdict":"pass"}' }),
		]);
		const runner = makeLlmRunner(runStep, { cwd: "/work" });
		const res = await runner.runRound(round());
		expect(res.payload).toEqual({ verdict: "pass" });
		expect(calls[1].task).toContain("failed validation");
	});

	it("treats a non-object JSON reply as missing and exhausts retries", async () => {
		const { runStep } = fakeRunStep([step({ finalText: "123" })]);
		const runner = makeLlmRunner(runStep, { cwd: "/work" });
		const res = await runner.runRound(round({ retries: 0 }));
		expect(res.payload).toBeNull();
		expect(res.attempts).toBe(1);
		expect(res.errors[0]).toContain("no JSON object");
	});

	it("records a nonzero exit (with and without stderr) and gives up", async () => {
		const { runStep } = fakeRunStep([
			step({ exitCode: 1, stderr: "kaboom" }),
			step({ exitCode: 3, stderr: "" }),
		]);
		const runner = makeLlmRunner(runStep, { cwd: "/work" });
		const res = await runner.runRound(round({ retries: 1 }));
		expect(res.payload).toBeNull();
		expect(res.attempts).toBe(2);
		expect(res.errors[0]).toContain("pi exited 1: kaboom");
		expect(res.errors[1]).toContain("pi exited 3");
	});

	it("breaks immediately when the step is aborted", async () => {
		const { runStep, calls } = fakeRunStep([step({ aborted: true })]);
		const runner = makeLlmRunner(runStep, { cwd: "/work" });
		const res = await runner.runRound(round());
		expect(res.payload).toBeNull();
		expect(res.errors[0]).toContain("aborted");
		expect(calls.length).toBe(1);
	});
});
