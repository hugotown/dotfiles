import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FALLBACK } from "../../src/config/defaults.ts";
import { configPaths, loadConfig } from "../../src/config/load.ts";

const roots: string[] = [];
function tmpRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-cfg-"));
	roots.push(root);
	return root;
}

afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("loadConfig", () => {
	it("uses fallback when no yaml exists", () => {
		const { config, sources } = loadConfig(tmpRoot(), tmpRoot());
		expect(config.version).toBe(FALLBACK.version);
		expect(sources).toEqual([]);
	});

	it("copies template to global and merges project override", () => {
		const ext = tmpRoot();
		fs.writeFileSync(configPaths(ext).template, "version: 1\ndefaults:\n  model: tmpl\n");
		const cwd = tmpRoot();
		const proj = path.join(cwd, ".pi", "obra-sp-flow");
		fs.mkdirSync(proj, { recursive: true });
		fs.writeFileSync(path.join(proj, "config.yaml"), "defaults:\n  model: proj\n");
		const { config, sources } = loadConfig(cwd, ext);
		expect(fs.existsSync(configPaths(ext).global)).toBe(true);
		expect(config.defaults.model).toBe("proj");
		expect(sources.length).toBe(2);
	});

	it("ignores invalid yaml", () => {
		const ext = tmpRoot();
		fs.writeFileSync(configPaths(ext).global, ":\n  : bad: [");
		const { config } = loadConfig(tmpRoot(), ext);
		expect(config.version).toBe(FALLBACK.version);
	});
});
