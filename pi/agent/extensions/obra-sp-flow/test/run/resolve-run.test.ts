import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listRuns } from "../../src/paths/run-list.ts";
import { resolveRun } from "../../src/run/resolve-run.ts";

const roots: string[] = [];
function tmpRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-runs-"));
	roots.push(root);
	return root;
}

function addRun(base: string, runId: string): void {
	const dir = path.join(base, runId);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "state.json"), "{}\n");
}

afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("run resolution", () => {
	it("lists runs newest first and resolves by selector", () => {
		const base = tmpRoot();
		addRun(base, "20260101T000000Z-old");
		addRun(base, "20260201T000000Z-new");
		expect(listRuns(base)).toEqual(["20260201T000000Z-new", "20260101T000000Z-old"]);
		expect(resolveRun(base)).toBe("20260201T000000Z-new");
		expect(resolveRun(base, "old")).toBe("20260101T000000Z-old");
		expect(resolveRun(base, "missing")).toBeNull();
	});

	it("handles missing and unreadable bases", () => {
		const file = path.join(tmpRoot(), "not-a-dir");
		fs.writeFileSync(file, "x");
		expect(listRuns(path.join(tmpRoot(), "missing"))).toEqual([]);
		expect(listRuns(file)).toEqual([]);
	});
});
