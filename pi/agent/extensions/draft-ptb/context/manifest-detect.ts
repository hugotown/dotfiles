// Project manifest and monorepo detection.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fileExists, readPackageJson } from "../utils.ts";

const MANIFESTS: Array<{ file: string; type: string }> = [
  { file: "package.json", type: "node" }, { file: "Cargo.toml", type: "rust" },
  { file: "pyproject.toml", type: "python" }, { file: "setup.py", type: "python" },
  { file: "requirements.txt", type: "python" }, { file: "go.mod", type: "go" },
  { file: "pom.xml", type: "java" }, { file: "build.gradle", type: "java" },
  { file: "build.gradle.kts", type: "java" }, { file: "mise.toml", type: "mise" },
  { file: ".mise.toml", type: "mise" }, { file: "Dockerfile", type: "docker" },
  { file: "deno.json", type: "deno" }, { file: "deno.jsonc", type: "deno" },
  { file: "bun.lockb", type: "bun" }, { file: "pnpm-workspace.yaml", type: "node" },
  { file: "turbo.json", type: "node" }, { file: "nx.json", type: "node" },
];

export async function detectManifests(pi: ExtensionAPI, cwd: string): Promise<{ manifests: string[]; types: string[] }> {
  const manifests: string[] = [];
  const typeSet = new Set<string>();
  for (const { file, type } of MANIFESTS) {
    if (await fileExists(pi, cwd, file)) { manifests.push(file); typeSet.add(type); }
  }
  return { manifests, types: Array.from(typeSet) };
}

export async function detectMonorepo(pi: ExtensionAPI, cwd: string, manifests: string[]): Promise<{ isMonorepo: boolean; workspaces: string[] }> {
  if (manifests.includes("turbo.json") || manifests.includes("nx.json") || manifests.includes("pnpm-workspace.yaml")) {
    return { isMonorepo: true, workspaces: await readWorkspaces(pi, cwd) };
  }
  if (manifests.includes("package.json")) {
    const json = await readPackageJson(pi, cwd);
    if (json) {
      const ws = Array.isArray(json.workspaces) ? json.workspaces : (json.workspaces as { packages?: string[] })?.packages;
      if (Array.isArray(ws)) return { isMonorepo: true, workspaces: ws as string[] };
    }
  }
  return { isMonorepo: false, workspaces: [] };
}

async function readWorkspaces(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const yml = await pi.exec("cat", ["pnpm-workspace.yaml"], { cwd });
  if (yml.code === 0) {
    const out: string[] = [];
    for (const line of yml.stdout.split("\n")) {
      const m = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/);
      if (m) out.push(m[1]);
    }
    if (out.length) return out;
  }
  const json = await readPackageJson(pi, cwd);
  if (json) {
    if (Array.isArray(json.workspaces)) return json.workspaces as string[];
    if ((json.workspaces as { packages?: string[] })?.packages) return (json.workspaces as { packages: string[] }).packages;
  }
  return [];
}
