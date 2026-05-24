import { describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Workflow } from "../types.ts";
import { buildState, loadState, mergeNodeResult, persistState, resumeState } from "../lib/state-store.ts";

const wf: Workflow = {
	name: "auth",
	vsm: [{ sipoc: "s", nodes: [
		{ id: "a", action: "bash", aiAssisted: false, depends_on: [], command: "x" },
		{ id: "b", action: "bash", aiAssisted: false, depends_on: ["a"], command: "y" },
	] }],
};

describe("state-store", () => {
	it("builds a pending state mirroring the workflow", () => {
		const s = buildState(wf, "args", 123);
		expect(s.vsm[0].nodes.map((n) => n.status)).toEqual(["pending", "pending"]);
		expect(s.arguments).toBe("args");
	});

	it("merges a node result", () => {
		const s = mergeNodeResult(buildState(wf, "", 1), "a", { status: "ok", output: "done" });
		expect(s.vsm[0].nodes[0].status).toBe("ok");
		expect(s.vsm[0].nodes[0].output).toBe("done");
	});

	it("resume keeps ok, resets running AND failed to pending", () => {
		let s = buildState(wf, "", 1);
		s = mergeNodeResult(s, "a", { status: "ok", output: "x" });
		s.vsm[0].nodes[1].status = "running";
		const r = resumeState(s);
		expect(r.vsm[0].nodes[0].status).toBe("ok");
		expect(r.vsm[0].nodes[1].status).toBe("pending");
	});

	it("atomic persist + reload round-trips and leaves no .tmp", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daddy-"));
		const file = path.join(dir, "auth.daddy.json");
		const s = buildState(wf, "args", 7);
		await persistState(file, s);
		expect(await loadState(file)).toEqual(s);
		expect(await fs.readdir(dir)).toEqual(["auth.daddy.json"]);
	});

	it("loadState returns null when the file is absent", async () => {
		expect(await loadState("/no/such/auth.daddy.json")).toBeNull();
	});
});
