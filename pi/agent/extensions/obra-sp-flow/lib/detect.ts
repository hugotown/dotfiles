// Best-effort verification command detection by stack. Returns "" when nothing
// is detected so the caller can decide whether absence is fatal (tests) or
// skippable (build/typecheck/lint/format). Detection is package-manager- and
// monorepo-aware: a bare `tsc --noEmit` at a monorepo root ignores per-package
// tsconfig (e.g. jsx) and yields FALSE failures, so it is used only for a single
// package — otherwise we defer to the project's own script (or the LLM fallback).

import * as fs from "node:fs";
import * as path from "node:path";
import { taskRunner } from "./task-runner.ts";

function exists(cwd: string, f: string): boolean {
  return fs.existsSync(path.join(cwd, f));
}

function readPkg(cwd: string): { scripts?: Record<string, string>; workspaces?: unknown } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
  } catch {
    return null;
  }
}

/** First script name from `names` that the package.json actually defines. */
function firstScript(cwd: string, names: string[]): string | null {
  const pkg = readPkg(cwd);
  if (!pkg?.scripts) return null;
  for (const n of names) {
    if (pkg.scripts[n]) return n;
  }
  return null;
}

function pkgManager(cwd: string): "pnpm" | "yarn" | "bun" | "npm" {
  if (exists(cwd, "pnpm-lock.yaml") || exists(cwd, "pnpm-workspace.yaml")) return "pnpm";
  if (exists(cwd, "yarn.lock")) return "yarn";
  if (exists(cwd, "bun.lock") || exists(cwd, "bun.lockb")) return "bun";
  return "npm";
}

function runScript(cwd: string, script: string): string {
  const pm = pkgManager(cwd);
  return pm === "npm" ? `npm run ${script}` : `${pm} run ${script}`;
}

/** A multi-package repo where a root-level bare `tsc` would be wrong. */
function isMonorepo(cwd: string): boolean {
  if (exists(cwd, "turbo.json") || exists(cwd, "pnpm-workspace.yaml") || exists(cwd, "lerna.json")) return true;
  return Boolean(readPkg(cwd)?.workspaces);
}

export function detectBuild(cwd: string): string {
  const tr = taskRunner(cwd, "build");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    const s = firstScript(cwd, ["build"]);
    return s ? runScript(cwd, s) : "";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo build";
  if (exists(cwd, "go.mod")) return "go build ./...";
  return "";
}

export function detectTypecheck(cwd: string): string {
  const tr = taskRunner(cwd, "typecheck");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    // Prefer the project's own (monorepo-aware) script. `check-types` is the
    // Turborepo/T3 convention; not finding it is what made the flow fall back to
    // a broken bare `tsc` and produce false TS17004 errors.
    const s = firstScript(cwd, ["typecheck", "check-types", "type-check", "tsc"]);
    if (s) return runScript(cwd, s);
    // Bare tsc is safe only for a single-package project.
    if (exists(cwd, "tsconfig.json") && !isMonorepo(cwd)) return "npx tsc --noEmit";
    return "";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo check";
  if (exists(cwd, "go.mod")) return "go vet ./...";
  return "";
}

export function detectLint(cwd: string): string {
  const tr = taskRunner(cwd, "lint");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    // `check` is the biome/ultracite convention (lint + format in one).
    const s = firstScript(cwd, ["lint", "check"]);
    return s ? runScript(cwd, s) : "";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo clippy -- -D warnings";
  if (exists(cwd, "go.mod")) return "golangci-lint run";
  return "";
}

export function detectTest(cwd: string): string {
  const tr = taskRunner(cwd, "test");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    const s = firstScript(cwd, ["test"]);
    return s ? runScript(cwd, s) : "";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo test";
  if (exists(cwd, "go.mod")) return "go test ./...";
  if (exists(cwd, "pyproject.toml") || exists(cwd, "pytest.ini")) return "pytest -q";
  if (exists(cwd, "deno.json")) return "deno test -A";
  return "";
}

export function detectFormat(cwd: string): string {
  const tr = taskRunner(cwd, "format");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    // Only check-style scripts: a bare `format` script usually REWRITES files,
    // which would always pass. Prefer explicit non-mutating variants.
    const s = firstScript(cwd, ["format:check", "fmt:check", "format-check", "check-format"]);
    return s ? runScript(cwd, s) : "";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo fmt --check";
  return "";
}
