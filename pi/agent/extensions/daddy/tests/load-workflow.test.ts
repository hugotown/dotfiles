import { describe, expect, it } from "bun:test";
import { normalizeWorkflow } from "../lib/load-workflow.ts";

describe("normalizeWorkflow", () => {
	it("defaults depends_on to [] and keeps node fields", () => {
		const wf = normalizeWorkflow({
			name: "auth",
			vsm: [{ sipoc: "disc", nodes: [{ id: "a", action: "bash", aiAssisted: false, command: "x" }] }],
		});
		expect(wf.vsm[0].nodes[0].depends_on).toEqual([]);
		expect(wf.vsm[0].nodes[0].command).toBe("x");
	});

	it("throws when vsm is missing", () => {
		expect(() => normalizeWorkflow({ name: "auth" })).toThrow("workflow has no vsm");
	});
});
