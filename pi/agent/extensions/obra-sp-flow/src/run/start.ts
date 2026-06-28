import * as fs from "node:fs";
import { getRunsBaseDir, runPaths, type RunPaths, ensureRunDirs } from "../paths/run-paths.ts";
import { createInitialState } from "../state/create.ts";
import type { ObraState } from "../types/state.ts";
import { writeAtomicJson } from "../util/fs-atomic.ts";
import { makeRunId, slugify } from "../util/slug.ts";
import { PHASE_PLAN } from "./phase-plan.ts";

export interface StartRunInput {
	requirement: string;
	parentSessionFile: string | null;
	date?: Date;
}

export interface StartRunResult {
	runId: string;
	paths: RunPaths;
	state: ObraState;
}

export function startRun(input: StartRunInput): StartRunResult {
	const date = input.date ?? new Date();
	const createdAt = date.toISOString();
	const runId = makeRunId(input.requirement, date);
	const paths = runPaths(getRunsBaseDir(input.parentSessionFile), runId);
	ensureRunDirs(paths);
	fs.writeFileSync(paths.inputPath, `${input.requirement.trim()}\n`, "utf-8");
	const state = createInitialState({
		runId,
		slug: slugify(input.requirement),
		request: input.requirement,
		parentSessionFile: input.parentSessionFile,
		createdAt,
		phases: PHASE_PLAN,
	});
	writeAtomicJson(paths.statePath, state);
	return { runId, paths, state };
}
