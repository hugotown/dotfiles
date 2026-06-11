// Canonical artifact locations, matching the superpowers skill defaults
// (docs/superpowers/specs and docs/superpowers/plans).

import * as path from "node:path";

export function featureSlug(idea: string): string {
  return (
    idea
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "feature"
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function specPath(cwd: string, idea: string): string {
  return path.join(cwd, "docs", "superpowers", "specs", `${today()}-${featureSlug(idea)}-design.md`);
}

export function planPath(cwd: string, idea: string): string {
  return path.join(cwd, "docs", "superpowers", "plans", `${today()}-${featureSlug(idea)}.md`);
}

// Everything obra-sp-flow writes per project lives under {cwd}/.pi/obra-sp-flow/.
export function projectDir(cwd: string): string {
  return path.join(cwd, ".pi", "obra-sp-flow");
}

export function projectConfigPath(cwd: string): string {
  return path.join(projectDir(cwd), "obra-sp-flow.yml");
}

export function logsDir(cwd: string): string {
  return path.join(projectDir(cwd), "logs");
}

export function logPath(cwd: string, idea: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(logsDir(cwd), `${stamp}_${featureSlug(idea)}.jsonl`);
}
