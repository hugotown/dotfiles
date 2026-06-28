/** Atomic JSON write (tmp + rename) and tolerant JSON read. */
import * as fs from "node:fs";
import * as path from "node:path";

function tmpName(filePath: string): string {
	const rand = Math.random().toString(36).slice(2);
	return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${rand}.tmp`);
}

export function writeAtomicJson(filePath: string, payload: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tempPath = tmpName(filePath);
	try {
		fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
		fs.renameSync(tempPath, filePath);
	} finally {
		try {
			fs.rmSync(tempPath, { force: true });
		} catch {
			/* best-effort cleanup */
		}
	}
}

export function readJson<T>(filePath: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}
