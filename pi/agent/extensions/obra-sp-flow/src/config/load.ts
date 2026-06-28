/** Load + merge config.yaml (global next to the extension, project override). */
import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ObraConfig } from "../types/config.ts";
import { CONFIG_DIR_NAME, FALLBACK } from "./defaults.ts";
import { deepMerge } from "./merge.ts";

export function configPaths(extDir: string) {
	return {
		global: path.join(extDir, "config.yaml"),
		template: path.join(extDir, "config.example.yaml"),
	};
}

function readYaml(file: string): Partial<ObraConfig> | null {
	try {
		if (!fs.existsSync(file)) return null;
		return (parseYaml(fs.readFileSync(file, "utf-8")) ?? {}) as Partial<ObraConfig>;
	} catch {
		return null;
	}
}

function ensureGlobalConfig(extDir: string): void {
	const { global, template } = configPaths(extDir);
	if (fs.existsSync(global) || !fs.existsSync(template)) return;
	fs.copyFileSync(template, global);
}

export function loadConfig(cwd: string, extDir: string): { config: ObraConfig; sources: string[] } {
	ensureGlobalConfig(extDir);
	const sources: string[] = [];
	let cfg: ObraConfig = { ...FALLBACK };
	const global = readYaml(configPaths(extDir).global);
	if (global) {
		cfg = deepMerge(cfg, global);
		sources.push(configPaths(extDir).global);
	}
	const projectPath = path.join(cwd, CONFIG_DIR_NAME, "obra-sp-flow", "config.yaml");
	const project = readYaml(projectPath);
	if (project) {
		cfg = deepMerge(cfg, project);
		sources.push(projectPath);
	}
	return { config: cfg, sources };
}

export function initProjectConfig(cwd: string, extDir: string): { path: string; created: boolean } {
	const target = path.join(cwd, CONFIG_DIR_NAME, "obra-sp-flow", "config.yaml");
	if (fs.existsSync(target)) return { path: target, created: false };
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const { global, template } = configPaths(extDir);
	if (fs.existsSync(template)) fs.copyFileSync(template, target);
	else if (fs.existsSync(global)) fs.copyFileSync(global, target);
	else fs.writeFileSync(target, "version: 1\n", "utf-8");
	return { path: target, created: true };
}
