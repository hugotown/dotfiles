import { describe, expect, it } from "bun:test";
import type { Workflow } from "../types.ts";
import { validateWorkflow } from "../lib/validate.ts";

function wf(nodes: Workflow["vsm"][number]["nodes"], name = "auth"): Workflow {
	return { name, vsm: [{ sipoc: "s", nodes }] };
}

describe("validateWorkflow", () => {
	it("accepts a sound workflow", () => {
		expect(
			validateWorkflow(
				wf([
					{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "bun test" },
					{ id: "b", action: "llm", aiAssisted: true, depends_on: ["a"], provider: "x", model: "y", variant: "low", prompt: "go $a.output" },
				]),
			),
		).toBeNull();
	});

	it("rejects a duplicate id", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "y" },
		]));
		expect(e?.kind).toBe("duplicate");
	});

	it("rejects a cycle", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: ["b"], command: "x" },
			{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" },
		]));
		expect(e?.kind).toBe("cycle");
	});

	it("rejects an unknown dependency", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: ["ghost"], command: "x" }]));
		expect(e?.kind).toBe("unknown-dependency");
	});

	it("rejects a $ref to a non-ancestor node", () => {
		const e = validateWorkflow(wf([
			{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
			{ id: "b", action: "llm", aiAssisted: true, depends_on: [], provider: "x", model: "y", variant: "low", prompt: "$a.output" },
		]));
		expect(e?.kind).toBe("unknown-ref");
	});

	it("rejects a missing per-action field (bash without command)", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: [] }]));
		expect(e?.kind).toBe("missing-field");
	});

	it("rejects bad aiAssisted (llm must be true)", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "llm", aiAssisted: false, depends_on: [], provider: "x", model: "y", variant: "low", prompt: "p" }]));
		expect(e?.kind).toBe("bad-ai-assisted");
	});

	it("rejects a multi-token workflow name", () => {
		const e = validateWorkflow(wf([{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" }], "auth feature"));
		expect(e?.kind).toBe("bad-name");
	});
});
