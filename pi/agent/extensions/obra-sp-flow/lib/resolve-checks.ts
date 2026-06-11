// Hybrid check-command resolution for ANY stack:
//   1. explicit value in the project config (always wins)
//   2. heuristic detection by stack (detect.ts)
//   3. LLM fallback — proposes a COMMAND (never a verdict) for unknown stacks
// The deterministic command's exit code stays the ONLY source of truth; the LLM
// only decides WHICH command to run, then we run it.

import type { Config } from "../types.ts";
import { detectBuild, detectFormat, detectLint, detectTest, detectTypecheck } from "./detect.ts";
import { runChildPi } from "./spawn-pi.ts";
import { repoContextBlock } from "./repo-context.ts";
import { extractJsonBlock } from "./json-extract.ts";

export type CheckName = "build" | "typecheck" | "test" | "lint" | "format";
export type ResolvedChecks = Record<CheckName, string>;

const NAMES: CheckName[] = ["build", "typecheck", "test", "lint", "format"];
const DETECTORS: Record<CheckName, (cwd: string) => string> = {
  build: detectBuild,
  typecheck: detectTypecheck,
  test: detectTest,
  lint: detectLint,
  format: detectFormat,
};

export interface ResolveResult {
  /** Final command per check (may be "" when nothing applies). */
  resolved: ResolvedChecks;
  /** Subset the LLM proposed — persisted to the project yml with provenance. */
  llmResolved: Partial<Record<CheckName, string>>;
}

function llmSystem(): string {
  return [
    "You are a build-tooling detector for an automated verification gate.",
    "Inspect the repository and determine the EXACT shell command to run each requested check.",
    "Hard rules:",
    "- Each command MUST be non-interactive and exit non-zero on failure.",
    "- Use the repo's real package manager / task runner (pnpm/yarn/bun/npm/cargo/go/uv/gradle/maven/make/etc.).",
    "- Prefer monorepo-aware commands (e.g. `turbo run check-types`) over bare per-file tools.",
    "- For a check that does not apply to this project, use an empty string.",
    "- You ONLY propose commands; you NEVER judge whether the code passes.",
  ].join("\n");
}

async function llmResolve(cwd: string, config: Config, missing: CheckName[]): Promise<Partial<Record<CheckName, string>>> {
  const pm = config.phases.plan;
  const repoCtx = repoContextBlock(cwd);
  const task = [
    repoCtx,
    `For THIS repository, give the shell command for each of these checks: ${missing.join(", ")}.`,
    "End your reply with a ```json object mapping each requested check to its command. Example:",
    '```json\n{"build":"pnpm build","typecheck":"turbo run check-types","test":"pnpm test","lint":"","format":""}\n```',
  ].join("\n\n");
  const res = await runChildPi(
    {
      provider: pm.provider,
      model: pm.model,
      thinking: "low",
      systemPrompt: llmSystem(),
      userTask: task,
      toolAllowlist: ["read", "ls", "grep", "find"],
      cwd,
      timeoutMs: config.limits.childTimeoutMs,
    },
    "resolve-checks",
  );
  const parsed = extractJsonBlock<Record<string, unknown>>(res.finalText) ?? {};
  const out: Partial<Record<CheckName, string>> = {};
  for (const n of missing) {
    const v = parsed[n];
    if (typeof v === "string" && v.trim()) out[n] = v.trim();
  }
  return out;
}

export async function resolveChecks(cwd: string, config: Config): Promise<ResolveResult> {
  const resolved = {} as ResolvedChecks;
  const missing: CheckName[] = [];
  for (const n of NAMES) {
    const cmd = config.checks[n] || DETECTORS[n](cwd);
    resolved[n] = cmd;
    if (!cmd) missing.push(n);
  }
  const llmResolved: Partial<Record<CheckName, string>> = {};
  if (missing.length) {
    try {
      const proposed = await llmResolve(cwd, config, missing);
      for (const n of missing) {
        const v = proposed[n];
        if (v) {
          resolved[n] = v;
          llmResolved[n] = v;
        }
      }
    } catch {
      /* resolver failed — leave the missing checks empty (skipped); never block */
    }
  }
  return { resolved, llmResolved };
}
