import { describe, expect, it } from "bun:test";
import { realPorts, uiFeedback } from "../../src/run/ports.ts";
import type { SpawnFn } from "../../src/run/spawn.ts";
import type { LlmStepResult, RunStep } from "../../src/types/llm.ts";
import type { CommandCtx } from "../../src/types/ports.ts";

function fakeCtx(): { ctx: CommandCtx; status: Array<{ id: string; text: string | undefined }> } {
	const status: Array<{ id: string; text: string | undefined }> = [];
	const ctx = {
		cwd: "/work",
		ui: { setStatus: (id: string, text: string | undefined) => status.push({ id, text }) },
	} as unknown as CommandCtx;
	return { ctx, status };
}

describe("uiFeedback", () => {
	it("routes a non-empty tick to the status line and ignores empty ticks", () => {
		const { ctx, status } = fakeCtx();
		const fb = uiFeedback(ctx);
		fb.tick("working…");
		fb.tick("");
		expect(status).toEqual([{ id: "obra-sp-flow", text: "working…" }]);
	});
});

describe("realPorts", () => {
	it("builds exec/llm/feedback with default deps", () => {
		const { ctx } = fakeCtx();
		const ports = realPorts(ctx);
		expect(ports.ctx).toBe(ctx);
		expect(typeof ports.exec).toBe("function");
		expect(typeof ports.llm.runRound).toBe("function");
		expect(typeof ports.feedback.tick).toBe("function");
	});

	it("wires injected spawn into exec and injected runStep + feedback into llm", async () => {
		const { ctx, status } = fakeCtx();
		const spawnImpl: SpawnFn = () => {
			throw new Error("exec invoked");
		};
		const runStep: RunStep = async (opts): Promise<LlmStepResult> => {
			opts.onActivity?.("llm tick");
			return { exitCode: 0, stderr: "", finalText: '{"verdict":"pass"}', aborted: false };
		};
		const ports = realPorts(ctx, { spawnImpl, runStep });

		const execResult = await ports.exec("ls", []);
		expect(execResult.code).toBeNull();
		expect(execResult.stderr).toContain("exec invoked");

		const round = await ports.llm.runRound({
			system: "s",
			task: "t",
			jsonTemplate: "{}",
			contract: (await import("../../src/contracts/base.ts")).loose({}),
			tools: "read",
			retries: 0,
		});
		expect(round.payload).toEqual({ verdict: "pass" });
		expect(status).toContainEqual({ id: "obra-sp-flow", text: "llm tick" });
	});
});
