// Shared utility functions used across the extension.
// Consolidates duplicated helpers (slugify, fileExists, dirExists).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Slugify a string — first N chars, alphanumeric + dashes only. */
export function slugify(s: string, maxLen = 30): string {
  return s.slice(0, maxLen).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/(^-+|-+$)/g, "") || "feature";
}

export async function fileExists(pi: ExtensionAPI, cwd: string, rel: string): Promise<boolean> {
  return (await pi.exec("test", ["-f", rel], { cwd })).code === 0;
}

export async function dirExists(pi: ExtensionAPI, cwd: string, rel: string): Promise<boolean> {
  return (await pi.exec("test", ["-d", rel], { cwd })).code === 0;
}

export async function readPackageJson(pi: ExtensionAPI, cwd: string): Promise<Record<string, unknown> | null> {
  const r = await pi.exec("cat", ["package.json"], { cwd });
  if (r.code !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

export async function packageHasScript(pi: ExtensionAPI, cwd: string, name: string): Promise<boolean> {
  const json = await readPackageJson(pi, cwd);
  return Boolean((json?.scripts as Record<string, unknown>)?.[name]);
}

export async function packageHasDep(pi: ExtensionAPI, cwd: string, dep: string): Promise<boolean> {
  const json = await readPackageJson(pi, cwd);
  if (!json) return false;
  const deps = { ...(json.dependencies as Record<string, unknown> ?? {}), ...(json.devDependencies as Record<string, unknown> ?? {}) };
  return Boolean(deps[dep]);
}
