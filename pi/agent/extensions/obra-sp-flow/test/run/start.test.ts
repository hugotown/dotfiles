import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getRunsBaseDir } from "../../src/paths/run-paths.ts";
import { startRun } from "../../src/run/start.ts";
import { readJson } from "../../src/util/fs-atomic.ts";

const roots: string[] = [];
function sessionFile(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-session-"));
	roots.push(root);
	return path.join(root, "session.jsonl");
}

afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("startRun", () => {
	it("creates deterministic run files and initial state", () => {
		const parent = sessionFile();
		const date = new Date("2026-06-27T13:25:00.123Z");
		const result = startRun({ requirement: "Crear Spec!", parentSessionFile: parent, date });
		expect(result.runId).toBe("20260627T132500Z-crear-spec");
		expect(fs.readFileSync(result.paths.inputPath, "utf-8")).toBe("Crear Spec!\n");
		const stored = readJson<typeof result.state>(result.paths.statePath);
		expect(stored?.currentPhaseId).toBe("preflight");
		expect(Object.keys(stored?.phases ?? {}).length).toBe(13);
	});

	it("falls back to tmp for ephemeral sessions", () => {
		const result = startRun({ requirement: "x", parentSessionFile: null, date: new Date(0) });
		expect(result.paths.runDir.startsWith(getRunsBaseDir(null))).toBe(true);
		fs.rmSync(result.paths.runDir, { recursive: true, force: true });
	});
});
