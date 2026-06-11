// Best-effort verification command detection by stack. Returns "" when nothing
// is detected so the caller can decide whether absence is fatal (tests) or
// skippable (typecheck/lint).

import * as fs from "node:fs";
import * as path from "node:path";
import { taskRunner } from "./task-runner.ts";

function exists(cwd: string, f: string): boolean {
  return fs.existsSync(path.join(cwd, f));
}

function pkgScript(cwd: string, name: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    return Boolean(pkg.scripts?.[name]);
  } catch {
    return false;
  }
}

export function detectTypecheck(cwd: string): string {
  const tr = taskRunner(cwd, "typecheck");
  if (tr) return tr;
  if (exists(cwd, "package.json")) {
    if (pkgScript(cwd, "typecheck")) return "npm run typecheck";
    if (exists(cwd, "tsconfig.json")) return "npx tsc --noEmit";
  }
  if (exists(cwd, "Cargo.toml")) return "cargo check";
  if (exists(cwd, "go.mod")) return "go vet ./...";
  return "";
}

export function detectLint(cwd: string): string {
  const tr = taskRunner(cwd, "lint");
  if (tr) return tr;
  if (exists(cwd, "package.json") && pkgScript(cwd, "lint")) return "npm run lint";
  if (exists(cwd, "Cargo.toml")) return "cargo clippy -- -D warnings";
  if (exists(cwd, "go.mod")) return "golangci-lint run";
  return "";
}

export function detectTest(cwd: string): string {
  const tr = taskRunner(cwd, "test");
  if (tr) return tr;
  if (exists(cwd, "package.json") && pkgScript(cwd, "test")) return "npm test";
  if (exists(cwd, "Cargo.toml")) return "cargo test";
  if (exists(cwd, "go.mod")) return "go test ./...";
  if (exists(cwd, "pyproject.toml") || exists(cwd, "pytest.ini")) return "pytest -q";
  if (exists(cwd, "deno.json")) return "deno test -A";
  return "";
}
