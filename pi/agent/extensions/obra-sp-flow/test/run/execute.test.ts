import { Type } from "@sinclair/typebox";
import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FALLBACK } from "../../src/config/defaults.ts";
import { loose } from "../../src/contracts/base.ts";
import { artifactRelForSeed } from "../../src/paths/artifact-name.ts";
import { ensureRunDirs, runPaths } from "../../src/paths/run-paths.ts";
import { executeRun } from "../../src/run/execute.ts";
import type { PhaseSeed } from "../../src/run/phase-plan.ts";
import type { PhaseRegistry } from "../../src/run/phase-registry.ts";
import { PortNotWiredError, placeholderPorts, type RunPorts } from "../../src/run/ports.ts";
import { createInitialState } from "../../src/state/create.ts";
import type { Phase } from "../../src/types/phase.ts";
import type { CommandCtx } from "../../src/types/ports.ts";
import type { ObraState } from "../../src/types/state.ts";
import { readJson } from "../../src/util/fs-atomic.ts";

const roots: string[] = [];
afterAll(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

const VERDICT = loose({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("block")]) });

function detPhase(id: string, payload: Record<string, unknown> = { verdict: "pass" }): Phase {
	return { id, index: 0, title: id, kind: "deterministic", contract: VERDICT, run: async () => payload };
}

function llmPhase(id: string): Phase {
	return {
		id,
		index: 0,
		title: id,
		kind: "llm",
		contract: VERDICT,
		buildPrompt: () => ({ system: "s", task: "t", jsonTemplate: "{}" }),
	};
}

function fakeLlmPorts(ctx: CommandCtx, payload: Record<string, unknown>): RunPorts {
	return {
		ctx,
		feedback: { tick: () => {} },
		exec: async () => ({ stdout: "", stderr: "", code: 0 }),
		llm: { runRound: async () => ({ payload, errors: [], attempts: 1 }) },
	};
}

function gatePhase(id: string, granted: boolean): Phase {
	return {
		id,
		index: 0,
		title: id,
		kind: "gate",
		contract: loose({ granted: Type.Boolean() }),
		run: async () => ({ verdict: "pass", granted }),
	};
}

function setup(plan: PhaseSeed[]): { statePath: string; runDir: string; artifactsDir: string; ctx: CommandCtx } {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-exec-"));
	roots.push(root);
	const paths = runPaths(path.join(root, "session-runs"), "run-1");
	ensureRunDirs(paths);
	const state = createInitialState({
		runId: "run-1",
		slug: "demo",
		request: "demo",
		parentSessionFile: null,
		createdAt: new Date().toISOString(),
		phases: plan,
	});
	fs.writeFileSync(paths.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	const ctx = { cwd: root } as CommandCtx;
	return { statePath: paths.statePath, runDir: paths.runDir, artifactsDir: paths.artifactsDir, ctx };
}

describe("executeRun", () => {
	it("runs a dummy deterministic phase: writes the artifact and advances state", async () => {
		const plan: PhaseSeed[] = [{ id: "demo", index: 0, kind: "deterministic", group: 1 }];
		const env = setup(plan);
		const registry: PhaseRegistry = { demo: detPhase("demo", { verdict: "pass", note: "hi" }) };

		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry,
			plan,
		});

		expect(result.kind).toBe("complete");
		const rel = artifactRelForSeed(plan[0]); // steps/00-demo.json (non-milestone)
		const artifact = readJson<Record<string, unknown>>(path.join(env.runDir, rel as string));
		expect(artifact?.note).toBe("hi");
		expect((artifact?._meta as { phase: string }).phase).toBe("demo");

		const state = readJson<ObraState>(env.statePath);
		expect(state?.status).toBe("completed");
		expect(state?.phases.demo.status).toBe("passed");
		expect(state?.phases.demo.artifact).toBe(rel as string);
		expect(state?.currentPhaseId).toBeNull();
	});

	it("writes the milestone artifact for a milestone step", async () => {
		const plan: PhaseSeed[] = [{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true }];
		const env = setup(plan);
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { preflight: detPhase("preflight") },
			plan,
		});
		expect(result.kind).toBe("complete");
		expect(fs.existsSync(path.join(env.runDir, "artifacts", "00-preflight.json"))).toBe(true);
	});

	it("blocks when a step has no registered phase", async () => {
		const plan: PhaseSeed[] = [{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true }];
		const env = setup(plan);
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: {},
			plan,
		});
		expect(result.kind).toBe("blocked");
		const state = readJson<ObraState>(env.statePath);
		expect(state?.status).toBe("blocked");
		expect(state?.phases.preflight.status).toBe("blocked");
	});

	it("pauses at a gate that is not granted, then completes once granted", async () => {
		const plan: PhaseSeed[] = [
			{ id: "approval-gate", index: 0, kind: "gate", group: 1 },
			{ id: "next", index: 1, kind: "deterministic", group: 2, milestone: true },
		];
		const env = setup(plan);
		const ports = placeholderPorts(env.ctx);

		const paused = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports,
			registry: { "approval-gate": gatePhase("approval-gate", false), next: detPhase("next") },
			plan,
		});
		expect(paused.kind).toBe("paused");
		let state = readJson<ObraState>(env.statePath);
		expect(state?.status).toBe("awaiting-approval");
		expect(state?.phases.next.status).toBe("pending");

		const done = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports,
			registry: { "approval-gate": gatePhase("approval-gate", true), next: detPhase("next") },
			plan,
		});
		expect(done.kind).toBe("complete");
		state = readJson<ObraState>(env.statePath);
		expect(state?.approval.granted).toBe(true);
		expect(state?.phases.next.status).toBe("passed");
	});

	it("runs an llm phase via the llm port and persists its payload", async () => {
		const plan: PhaseSeed[] = [{ id: "context-extract", index: 2, kind: "llm", group: 1 }];
		const env = setup(plan);
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: fakeLlmPorts(env.ctx, { verdict: "pass", summary: "ok" }),
			registry: { "context-extract": llmPhase("context-extract") },
			plan,
		});
		expect(result.kind).toBe("complete");
		const artifact = readJson<Record<string, unknown>>(
			path.join(env.runDir, "artifacts", "steps", "02-context-extract.json"),
		);
		expect(artifact?.summary).toBe("ok");
	});

	it("fails the run when a phase throws", async () => {
		const plan: PhaseSeed[] = [{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true }];
		const env = setup(plan);
		const boom: Phase = {
			id: "preflight",
			index: 0,
			title: "preflight",
			kind: "deterministic",
			contract: VERDICT,
			run: async () => {
				throw new Error("kaboom");
			},
		};
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { preflight: boom },
			plan,
		});
		expect(result.kind).toBe("blocked");
		const state = readJson<ObraState>(env.statePath);
		expect(state?.status).toBe("failed");
		expect(state?.phases.preflight.status).toBe("failed");
		expect(state?.phases.preflight.error).toContain("kaboom");
	});

	it("blocks when a payload fails its contract", async () => {
		const plan: PhaseSeed[] = [{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true }];
		const env = setup(plan);
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { preflight: { id: "preflight", index: 0, title: "preflight", kind: "deterministic", contract: VERDICT, run: async () => ({}) } },
			plan,
		});
		expect(result.kind).toBe("blocked");
		const state = readJson<ObraState>(env.statePath);
		expect(state?.phases.preflight.status).toBe("blocked");
		expect(state?.phases.preflight.error).toContain("contract invalid");
	});

	it("exposes readArtifact to phases (prior artifact, missing id, gate -> null)", async () => {
		const plan: PhaseSeed[] = [
			{ id: "g", index: 0, kind: "gate", group: 1 },
			{ id: "p1", index: 1, kind: "deterministic", group: 2, milestone: true },
			{ id: "p2", index: 2, kind: "deterministic", group: 3, milestone: true },
		];
		const env = setup(plan);
		const reader: Phase = {
			id: "p2",
			index: 2,
			title: "p2",
			kind: "deterministic",
			contract: VERDICT,
			run: async (rc) => ({
				verdict: "pass",
				sawP1: rc.readArtifact("p1") !== null,
				sawMissing: rc.readArtifact("missing") === null,
				sawGate: rc.readArtifact("g") === null,
			}),
		};
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { g: gatePhase("g", true), p1: detPhase("p1"), p2: reader },
			plan,
		});
		expect(result.kind).toBe("complete");
		const artifact = readJson<Record<string, unknown>>(path.join(env.runDir, "artifacts", "03-workspace.json"));
		expect(artifact?.sawP1).toBe(true);
		expect(artifact?.sawMissing).toBe(true);
		expect(artifact?.sawGate).toBe(true);
	});

	it("skips a phase whose shouldRun returns false (no artifact)", async () => {
		const plan: PhaseSeed[] = [{ id: "p1", index: 1, kind: "deterministic", group: 1 }];
		const env = setup(plan);
		const skipped: Phase = { ...detPhase("p1"), shouldRun: () => false };
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { p1: skipped },
			plan,
		});
		expect(result.kind).toBe("complete");
		const state = readJson<ObraState>(env.statePath);
		expect(state?.phases.p1.status).toBe("passed");
		expect(fs.existsSync(path.join(env.runDir, "artifacts", "steps", "01-p1.json"))).toBe(false);
	});

	it("placeholder exec/llm ports throw until Step C wires them", async () => {
		const ports = placeholderPorts({ cwd: "/" } as CommandCtx);
		ports.feedback.tick("noop");
		expect(ports.exec("ls", [])).rejects.toThrow(PortNotWiredError);
		expect(ports.llm.runRound({} as never)).rejects.toThrow(PortNotWiredError);
	});

	it("blocks when a phase returns verdict block", async () => {
		const plan: PhaseSeed[] = [{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true }];
		const env = setup(plan);
		const result = await executeRun({
			statePath: env.statePath,
			runDir: env.runDir,
			artifactsDir: env.artifactsDir,
			config: FALLBACK,
			ports: placeholderPorts(env.ctx),
			registry: { preflight: detPhase("preflight", { verdict: "block", blockers: ["dirty repo"] }) },
			plan,
		});
		expect(result.kind).toBe("blocked");
		const state = readJson<ObraState>(env.statePath);
		expect(state?.phases.preflight.status).toBe("blocked");
		expect(state?.phases.preflight.blockers).toEqual(["dirty repo"]);
	});
});
