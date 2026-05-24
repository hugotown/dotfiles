import { describe, expect, it } from "bun:test";
import type { StateMachine } from "../types.ts";
import { partitionReady } from "../lib/driver.ts";

function st(nodes: StateMachine["vsm"][number]["nodes"]): StateMachine {
	return { workflow: "w", arguments: "", startedAt: "", pid: 1, heartbeat: "", vsm: [{ sipoc: "s", nodes }] };
}

describe("partitionReady", () => {
	it("returns subprocess nodes whose deps are all ok", () => {
		const p = partitionReady(st([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "ok" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], status: "pending", command: "y" },
		]));
		expect(p.subprocess.map((n) => n.id)).toEqual(["b"]);
		expect(p.done).toBe(false);
	});

	it("skips a node with a failed dependency", () => {
		const p = partitionReady(st([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "failed" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], status: "pending" },
		]));
		expect(p.toSkip.map((n) => n.id)).toEqual(["b"]);
		expect(p.subprocess).toEqual([]);
	});

	it("partitions AI-ask separately from subprocess (subprocess drained first)", () => {
		const p = partitionReady(st([
			{ id: "q", action: "ask", aiAssisted: true, depends_on: [], status: "pending", prompt: "why" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: [], status: "pending", command: "y" },
		]));
		expect(p.subprocess.map((n) => n.id)).toEqual(["b"]);
		expect(p.aiAsk.map((n) => n.id)).toEqual(["q"]);
	});

	it("done is true when nothing is pending", () => {
		const p = partitionReady(st([{ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "ok" }]));
		expect(p.done).toBe(true);
	});
});
