import { describe, expect, it } from "bun:test";
import { runBashNode } from "../lib/run-bash-node.ts";

describe("runBashNode", () => {
	it("returns ok with stdout for a zero-exit command", async () => {
		const r = await runBashNode({ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "running", command: "echo hi" }, process.cwd());
		expect(r.status).toBe("ok");
		expect(r.output.trim()).toBe("hi");
	});

	it("returns failed for a non-zero exit", async () => {
		const r = await runBashNode({ id: "a", action: "bash", aiAssisted: false, depends_on: [], status: "running", command: "exit 3" }, process.cwd());
		expect(r.status).toBe("failed");
	});
});
