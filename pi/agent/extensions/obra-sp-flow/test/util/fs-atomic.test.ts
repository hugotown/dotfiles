import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readJson, writeAtomicJson } from "../../src/util/fs-atomic.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "obra-fsatomic-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("fs-atomic", () => {
	it("writes nested path atomically and reads it back", () => {
		const file = path.join(tmp, "nested", "a.json");
		writeAtomicJson(file, { a: 1 });
		expect(readJson<{ a: number }>(file)).toEqual({ a: 1 });
		expect(fs.readFileSync(file, "utf-8").endsWith("\n")).toBe(true);
	});
	it("readJson returns null for missing/invalid", () => {
		expect(readJson(path.join(tmp, "missing.json"))).toBeNull();
	});
});
