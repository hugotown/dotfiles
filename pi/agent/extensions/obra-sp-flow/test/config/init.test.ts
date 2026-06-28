import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { configPaths, initProjectConfig } from "../../src/config/load.ts";
import { EXT_DIR } from "../../src/config/resolve.ts";

const roots: string[] = [];
function tmpRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-init-"));
	roots.push(root);
	return root;
}

afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("initProjectConfig", () => {
	it("creates from template, then reports existing", () => {
		const ext = tmpRoot();
		fs.writeFileSync(configPaths(ext).template, "version: 1\n");
		const cwd = tmpRoot();
		const first = initProjectConfig(cwd, ext);
		expect(first.created).toBe(true);
		expect(fs.existsSync(first.path)).toBe(true);
		expect(initProjectConfig(cwd, ext).created).toBe(false);
	});

	it("falls back to global then to minimal stub", () => {
		const extGlobal = tmpRoot();
		fs.writeFileSync(configPaths(extGlobal).global, "version: 1\n");
		expect(initProjectConfig(tmpRoot(), extGlobal).created).toBe(true);
		const created = initProjectConfig(tmpRoot(), tmpRoot());
		expect(fs.readFileSync(created.path, "utf-8")).toContain("version: 1");
	});

	it("resolve points at the extension dir", () => {
		expect(EXT_DIR.endsWith("obra-sp-flow")).toBe(true);
	});
});
