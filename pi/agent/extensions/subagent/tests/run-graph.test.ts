import { describe, expect, test } from "bun:test";
import type { AgentResult } from "../result.ts";
import type { AgentSpec } from "../types.ts";
import { runGraph } from "../lib/run-graph.ts";
import { ok, skipped, spec } from "./fixtures.ts";

function trackConcurrency(limit: number) {
	const specs = Array.from({ length: 4 }, (_, i) => spec(`a${i}`)).slice(0, limit === 3 ? 3 : 4);
	let active = 0;
	let maxActive = 0;
	const runOne = async (s: AgentSpec) => {
		active++;
		maxActive = Math.max(maxActive, active);
		await new Promise((r) => setTimeout(r, 5));
		active--;
		return ok(s, s.name);
	};
	return { specs, runOne, peak: () => maxActive };
}

describe("runGraph", () => {
	test("runs independent agents in parallel", async () => {
		const t = trackConcurrency(3);
		await runGraph(t.specs, t.runOne, skipped, 3);
		expect(t.peak()).toBe(3);
	});

	test("respects the concurrency limit", async () => {
		const t = trackConcurrency(4);
		await runGraph(t.specs, t.runOne, skipped, 2);
		expect(t.peak()).toBeLessThanOrEqual(2);
	});

	test("a dependent runs after its dependency and receives its output", async () => {
		const order: string[] = [];
		let received: AgentResult[] = [];
		const runOne = async (s: AgentSpec, deps: AgentResult[]) => {
			order.push(s.name);
			if (s.name === "b") received = deps;
			await new Promise((r) => setTimeout(r, 1));
			return ok(s, `out-${s.name}`);
		};
		await runGraph([spec("b", ["a"]), spec("a")], runOne, skipped, 4);
		expect(order).toEqual(["a", "b"]);
		expect(received.map((d) => d.name)).toEqual(["a"]);
		expect(received[0].output).toBe("out-a");
	});

	test("skips dependents (transitively) when a dependency fails", async () => {
		const specs = [spec("a"), spec("b", ["a"]), spec("c", ["b"])];
		const runOne = async (s: AgentSpec) => (s.name === "a" ? { ...ok(s, ""), status: "failed" as const } : ok(s, s.name));
		const results = await runGraph(specs, runOne, skipped, 4);
		expect(results.get("a")!.status).toBe("failed");
		expect(results.get("b")!.status).toBe("skipped");
		expect(results.get("c")!.status).toBe("skipped");
	});

	test("runs a diamond dependency only once per node", async () => {
		const specs = [spec("a"), spec("b", ["a"]), spec("c", ["a"]), spec("d", ["b", "c"])];
		const runs = new Map<string, number>();
		const runOne = async (s: AgentSpec) => {
			runs.set(s.name, (runs.get(s.name) ?? 0) + 1);
			await new Promise((r) => setTimeout(r, 1));
			return ok(s, s.name);
		};
		const results = await runGraph(specs, runOne, skipped, 4);
		expect([...runs.values()].every((n) => n === 1)).toBe(true);
		expect(results.get("d")!.status).toBe("ok");
	});
});
