// lib/script-detect.ts — Inline-vs-named detection + runtime argv construction.
import type { ScriptSpec } from "../types.ts";

const META = /[\s;(){}&|<>$`"']/;

export function isInline(script: string): boolean {
  return script.includes("\n") || META.test(script);
}

export function runtimeForFile(path: string): "bun" | "uv" {
  return path.endsWith(".py") ? "uv" : "bun";
}

export function buildScriptArgv(spec: ScriptSpec, code: string): string[] {
  const runtime = spec.runtime ?? "bun";
  const inline = spec.inline !== undefined;
  if (runtime === "uv") {
    const withDeps = (spec.deps ?? []).flatMap((d) => ["--with", d]);
    return inline ? ["uv", "run", ...withDeps, "python", "-c", code] : ["uv", "run", ...withDeps, code];
  }
  return inline ? ["bun", "--no-env-file", "-e", code] : ["bun", "--no-env-file", "run", code];
}
