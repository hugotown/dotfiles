// lib/discovery.ts — Resolve workflow/command files; earlier dirs override later ones.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseWorkflow } from "./loader.ts";

function firstExisting(dirs: string[], rel: string): string | null {
  for (const d of dirs) {
    const p = path.join(d, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function findWorkflow(name: string, dirs: string[]): string | null {
  return firstExisting(dirs, path.join("workflows", `${name}.yaml`));
}

export function findCommand(name: string, dirs: string[]): string | null {
  return firstExisting(dirs, path.join("commands", `${name}.md`));
}

export function listWorkflows(dirs: string[]): { name: string; description: string }[] {
  const seen = new Map<string, { name: string; description: string }>();
  for (const d of dirs) {
    const wd = path.join(d, "workflows");
    if (!fs.existsSync(wd)) continue;
    for (const f of fs.readdirSync(wd)) {
      const name = f.replace(/\.yaml$/, "");
      if (!f.endsWith(".yaml") || seen.has(name)) continue;
      try {
        const def = parseWorkflow(fs.readFileSync(path.join(wd, f), "utf-8"));
        seen.set(name, { name, description: def.description });
      } catch { /* skip invalid */ }
    }
  }
  return [...seen.values()];
}
