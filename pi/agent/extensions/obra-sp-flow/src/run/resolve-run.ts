import { listRuns } from "../paths/run-list.ts";

export function resolveRun(baseDir: string, selector?: string): string | null {
	const runs = listRuns(baseDir);
	if (!selector) return runs[0] ?? null;
	return runs.find((runId) => runId === selector || runId.includes(selector)) ?? null;
}
