import { describe, expect, it } from "bun:test";
import type { StateMachine } from "../types.ts";
import { collectRefs, resolveRefs } from "../lib/resolve-refs.ts";

const state: StateMachine = {
	workflow: "w", arguments: "build the thing", startedAt: "", pid: 1, heartbeat: "",
	vsm: [{ sipoc: "s", nodes: [
		{ id: "scope", action: "ask", aiAssisted: true, depends_on: [], status: "ok", output: "auth only" },
	] }],
};

describe("collectRefs", () => {
	it("finds $node.output references", () => {
		expect(collectRefs("CONTEXT: $scope.output and $other.output")).toEqual(["scope", "other"]);
	});
	it("ignores $ARGUMENTS", () => {
		expect(collectRefs("see $ARGUMENTS")).toEqual([]);
	});
});

describe("resolveRefs", () => {
	it("substitutes a known node output", () => {
		expect(resolveRefs("CTX: $scope.output", state, "")).toBe("CTX: auth only");
	});
	it("substitutes $ARGUMENTS", () => {
		expect(resolveRefs("task: $ARGUMENTS", state, "build the thing")).toBe("task: build the thing");
	});
	it("throws on an unknown node ref", () => {
		expect(() => resolveRefs("$ghost.output", state, "")).toThrow("unknown reference: $ghost.output");
	});
});
