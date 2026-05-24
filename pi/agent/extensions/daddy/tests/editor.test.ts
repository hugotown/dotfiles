import { describe, expect, it } from "bun:test";
import { addNode, addSipoc, connect, removeNode, toYaml } from "../panel/editor.ts";
import type { Workflow } from "../types.ts";

const base: Workflow = { name: "auth", vsm: [{ sipoc: "disc", nodes: [] }] };

describe("editor tree ops", () => {
	it("adds a node to a sipoc chain", () => {
		const wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		expect(wf.vsm[0].nodes.map((n) => n.id)).toEqual(["a"]);
	});

	it("adds a sipoc chain", () => {
		const wf = addSipoc(base, "impl");
		expect(wf.vsm.map((c) => c.sipoc)).toEqual(["disc", "impl"]);
	});

	it("connects a node to a dependency", () => {
		let wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		wf = addNode(wf, "disc", { id: "b", action: "bash", aiAssisted: false, depends_on: [], command: "y" });
		wf = connect(wf, "b", "a");
		expect(wf.vsm[0].nodes[1].depends_on).toEqual(["a"]);
	});

	it("removes a node and prunes it from dependents", () => {
		let wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		wf = addNode(wf, "disc", { id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" });
		wf = removeNode(wf, "a");
		expect(wf.vsm[0].nodes.map((n) => n.id)).toEqual(["b"]);
		expect(wf.vsm[0].nodes[0].depends_on).toEqual([]);
	});

	it("serializes to YAML round-trippable text", () => {
		const wf = addNode(base, "disc", { id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" });
		expect(toYaml(wf)).toContain("name: auth");
		expect(toYaml(wf)).toContain("id: a");
	});
});
