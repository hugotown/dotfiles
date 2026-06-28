/** List run ids that have a state.json, most recent first (name = timestamp). */
import * as fs from "node:fs";
import * as path from "node:path";

export function listRuns(baseDir: string): string[] {
	if (!fs.existsSync(baseDir)) return [];
	let entries: string[];
	try {
		entries = fs.readdirSync(baseDir);
	} catch {
		return [];
	}
	return entries
		.filter((name) => fs.existsSync(path.join(baseDir, name, "state.json")))
		.sort()
		.reverse();
}
