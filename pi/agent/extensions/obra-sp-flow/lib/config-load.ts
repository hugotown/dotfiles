// Loads the extension defaults (config.yml) and deep-merges a trusted
// project override at {cwd}/.pi/obra-sp-flow.yml. Scalars support "$ENV" and
// "$ENV:fallback". Project values win over defaults.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { Config, PhaseModel, Thinking } from "../types.ts";

const ENV_REF = /^\$([A-Z_][A-Z0-9_]*)(?::(.*))?$/s;
type Raw = Record<string, any>;

function resolveEnv(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = v.match(ENV_REF);
  if (!m) return v;
  const [, name, fallback] = m;
  return process.env[name] ?? fallback ?? v;
}

function deepResolve(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(deepResolve);
  if (v && typeof v === "object") {
    const out: Raw = {};
    for (const [k, val] of Object.entries(v)) out[k] = deepResolve(val);
    return out;
  }
  return resolveEnv(v);
}

function deepMerge(base: Raw, over: unknown): Raw {
  if (!over || typeof over !== "object" || Array.isArray(over)) return base;
  const out: Raw = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) ? deepMerge(b, v) : v;
  }
  return out;
}

function phaseModel(raw: Raw = {}): PhaseModel {
  return {
    provider: String(raw.provider),
    model: String(raw.model),
    thinking: (raw.thinking ?? "medium") as Thinking,
    rules: Array.isArray(raw.rules) ? raw.rules.map(String) : [],
    tools: Array.isArray(raw.tools) ? raw.tools.map(String) : [],
  };
}

function toConfig(raw: Raw): Config {
  const p = raw.phases ?? {};
  const l = raw.limits ?? {};
  return {
    phases: {
      brainstorm: phaseModel(p.brainstorm),
      plan: phaseModel(p.plan),
      implement: phaseModel(p.implement),
      implement_escalate: phaseModel(p.implement_escalate ?? p.review),
      review: phaseModel(p.review),
      debug: phaseModel(p.debug),
    },
    limits: {
      implConcurrency: Number(l.impl_concurrency ?? 4),
      debugSubcyclesPerError: Number(l.debug_subcycles_per_error ?? 5),
      debugGlobalCap: Number(l.debug_global_cap ?? 15),
      questionArchitectureThreshold: Number(l.question_architecture_threshold ?? 3),
      coverageThreshold: Number(l.coverage_threshold ?? 90),
    },
    branch: { prefix: String(raw.branch?.prefix ?? "feature"), base: String(raw.branch?.base ?? "main") },
    finish: { action: (raw.finish?.action ?? "pr") as Config["finish"]["action"] },
    checks: {
      typecheck: String(raw.checks?.typecheck ?? ""),
      lint: String(raw.checks?.lint ?? ""),
      test: String(raw.checks?.test ?? ""),
    },
    skillsDir: String(raw.skills_dir ?? "$HOME/.config/agents/skills"),
  };
}

export function defaultConfigPath(): string {
  return fileURLToPath(new URL("../config.yml", import.meta.url));
}

export function loadConfig(cwd: string, trusted: boolean): Config {
  const base = deepResolve(parseYaml(fs.readFileSync(defaultConfigPath(), "utf-8")) ?? {}) as Raw;
  let merged = base;
  if (trusted) {
    const projPath = path.join(cwd, ".pi", "obra-sp-flow.yml");
    if (fs.existsSync(projPath)) {
      const over = deepResolve(parseYaml(fs.readFileSync(projPath, "utf-8")) ?? {});
      merged = deepMerge(base, over);
    }
  }
  return toConfig(merged);
}
