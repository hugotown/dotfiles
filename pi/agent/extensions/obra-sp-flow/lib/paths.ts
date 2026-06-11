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
