/** Run directory layout, anchored to the parent pi session. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const RUNS_FOLDER = "obra-sp-flow-runs";

/** Base where all runs live (next to the session file, or tmp if ephemeral). */
export function getRunsBaseDir(sessionFile: string | null | undefined): string {
	if (sessionFile) return path.join(path.dirname(sessionFile), RUNS_FOLDER);
	return path.join(os.tmpdir(), RUNS_FOLDER);
}

export interface RunPaths {
	runDir: string;
	artifactsDir: string;
	statePath: string;
	inputPath: string;
}

export function runPaths(baseDir: string, runId: string): RunPaths {
	const runDir = path.join(baseDir, runId);
	return {
		runDir,
		artifactsDir: path.join(runDir, "artifacts"),
		statePath: path.join(runDir, "state.json"),
		inputPath: path.join(runDir, "input.md"),
	};
}

export function ensureRunDirs(p: RunPaths): void {
	fs.mkdirSync(p.artifactsDir, { recursive: true });
}
