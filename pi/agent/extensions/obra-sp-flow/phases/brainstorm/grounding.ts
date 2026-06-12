// Deterministic grounding for the brainstorm phase — replaces the LLM-driven
// child pi with pure filesystem inspection. Zero LLM calls, zero network, runs
// in milliseconds. Produces a compact `repoUnderstanding` string the questions
// node can trust as ground truth.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Public contracts ────────────────────────────────────────────────────────

export interface GroundingInput {
  cwd: string;
  idea: string; // carried for context in summary, not used for detection
}

export interface StackInfo {
  primary: "node" | "rust" | "go" | "python" | "ruby" | "php" | "jvm" | "dotnet" | "dart" | "elixir" | "deno" | "unknown";
  runtime?: string;
  framework?: string;
  monorepo?: string;
}

export interface ConfigFile {
  path: string; // relative to cwd
  content: string; // truncated if too long
  tier: 1 | 2;
}

export interface GroundingOutput {
  tree: string;
  stack: StackInfo;
  configs: ConfigFile[];
  summary: string; // ready-to-inject block for the LLM
}

// ─── Configuration ───────────────────────────────────────────────────────────

const TREE_DEPTH = 3;
const MANIFEST_DEPTH = 3;
const CONFIG_DEPTH = 2;
const MAX_MANIFESTS = 10;
const MAX_MANIFEST_READ = 5;
const MAX_FILE_LINES = 80;
const TREE_CAP = 4000;

const EXCLUDED_DIRS = [
  "node_modules", ".git", "dist", "build", "coverage", ".next", ".nuxt",
  "out", "target", "vendor", "__pycache__", ".venv", "venv", ".turbo",
  ".cache", ".output",
];

// Tier 1: stack manifests (searched up to MANIFEST_DEPTH)
const TIER1_PATTERNS: Array<{ file: string; stack: StackInfo["primary"] }> = [
  { file: "package.json", stack: "node" },
  { file: "Cargo.toml", stack: "rust" },
  { file: "go.mod", stack: "go" },
  { file: "pyproject.toml", stack: "python" },
  { file: "setup.py", stack: "python" },
  { file: "Gemfile", stack: "ruby" },
  { file: "composer.json", stack: "php" },
  { file: "build.gradle.kts", stack: "jvm" },
  { file: "build.gradle", stack: "jvm" },
  { file: "pom.xml", stack: "jvm" },
  { file: "pubspec.yaml", stack: "dart" },
  { file: "mix.exs", stack: "elixir" },
  { file: "deno.json", stack: "deno" },
  { file: "deno.jsonc", stack: "deno" },
];

// Tier 2: design-affecting configs (searched up to CONFIG_DEPTH)
const TIER2_FILES = [
  "tsconfig.json", "biome.json", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
  "vite.config.ts", "vite.config.js", "next.config.ts", "next.config.js", "next.config.mjs",
  "nuxt.config.ts", "astro.config.mjs", "svelte.config.js",
  "tailwind.config.ts", "tailwind.config.js",
  "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
  ".env.example", ".env.local.example",
  "turbo.json", "nx.json", "lerna.json",
  "wrangler.toml", "vercel.json", "netlify.toml",
  "prisma/schema.prisma", "drizzle.config.ts", "drizzle.config.js",
  "mise.toml", "mise.local.toml",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sh(cwd: string, cmd: string): string {
  try {
    return execSync(cmd, {
      cwd, encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function fileExists(cwd: string, rel: string): boolean {
  return fs.existsSync(path.join(cwd, rel));
}

function readFileSafe(abs: string, maxLines: number): string {
  try {
    const raw = fs.readFileSync(abs, "utf-8");
    const lines = raw.split("\n");
    if (lines.length <= maxLines) return raw;
    return lines.slice(0, maxLines).join("\n") + "\n… (truncated)";
  } catch {
    return "";
  }
}

/** Recursively find files matching a name up to `maxDepth` levels, excluding
 *  common vendor/build dirs. Returns paths relative to cwd. */
function findFiles(cwd: string, fileName: string, maxDepth: number): string[] {
  const results: string[] = [];
  const excludeSet = new Set(EXCLUDED_DIRS);

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludeSet.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      } else if (entry.name === fileName) {
        results.push(path.relative(cwd, path.join(dir, entry.name)));
      }
    }
  }

  walk(cwd, 0);
  return results;
}

// ─── Tree ────────────────────────────────────────────────────────────────────

function buildTree(cwd: string): string {
  const pruneArg = EXCLUDED_DIRS.join("|");
  const eza = sh(cwd, `eza -T -L ${TREE_DEPTH} --git-ignore --group-directories-first -I "${pruneArg}" .`);
  if (eza.trim()) {
    return eza.trim().length <= TREE_CAP ? eza.trim() : `${eza.trim().slice(0, TREE_CAP)}\n… (truncated)`;
  }
  // Fallback without eza
  const find = sh(cwd, `find . -maxdepth ${TREE_DEPTH} -not -path "*/node_modules/*" -not -path "*/.git/*" | sort`);
  const trimmed = find.trim();
  return trimmed.length <= TREE_CAP ? trimmed : `${trimmed.slice(0, TREE_CAP)}\n… (truncated)`;
}

// ─── Stack detection ─────────────────────────────────────────────────────────

function detectRuntime(cwd: string): string | undefined {
  if (fileExists(cwd, "bun.lock") || fileExists(cwd, "bun.lockb")) return "bun";
  if (fileExists(cwd, "pnpm-lock.yaml")) return "pnpm";
  if (fileExists(cwd, "yarn.lock")) return "yarn";
  if (fileExists(cwd, "deno.json") || fileExists(cwd, "deno.jsonc")) return "deno";
  if (fileExists(cwd, "package-lock.json")) return "npm";
  return undefined;
}

function detectFramework(cwd: string): string | undefined {
  // Check package.json dependencies for framework
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps["next"]) return "next";
    if (allDeps["nuxt"]) return "nuxt";
    if (allDeps["@remix-run/node"] || allDeps["@remix-run/react"]) return "remix";
    if (allDeps["astro"]) return "astro";
    if (allDeps["svelte"] || allDeps["@sveltejs/kit"]) return "svelte";
    if (allDeps["vue"]) return "vue";
    if (allDeps["@angular/core"]) return "angular";
    if (allDeps["hono"]) return "hono";
    if (allDeps["express"]) return "express";
    if (allDeps["fastify"]) return "fastify";
  } catch { /* no package.json */ }

  // Config file presence
  if (fileExists(cwd, "next.config.ts") || fileExists(cwd, "next.config.js") || fileExists(cwd, "next.config.mjs")) return "next";
  if (fileExists(cwd, "nuxt.config.ts")) return "nuxt";
  if (fileExists(cwd, "astro.config.mjs")) return "astro";
  if (fileExists(cwd, "svelte.config.js")) return "svelte";
  return undefined;
}

function detectMonorepo(cwd: string): string | undefined {
  if (fileExists(cwd, "turbo.json")) return "turbo";
  if (fileExists(cwd, "nx.json")) return "nx";
  if (fileExists(cwd, "lerna.json")) return "lerna";
  if (fileExists(cwd, "pnpm-workspace.yaml")) return "pnpm-workspace";
  // Cargo workspaces
  try {
    const cargo = fs.readFileSync(path.join(cwd, "Cargo.toml"), "utf-8");
    if (/\[workspace\]/.test(cargo)) return "cargo-workspace";
  } catch { /* no Cargo.toml */ }
  // package.json workspaces
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    if (pkg.workspaces) return "npm-workspaces";
  } catch { /* no package.json */ }
  // Go workspace
  if (fileExists(cwd, "go.work")) return "go-workspace";
  return undefined;
}

function detectStack(cwd: string): StackInfo {
  // Primary: first tier-1 manifest found at root wins
  let primary: StackInfo["primary"] = "unknown";
  for (const { file, stack } of TIER1_PATTERNS) {
    if (fileExists(cwd, file)) {
      primary = stack;
      break;
    }
  }
  return {
    primary,
    runtime: detectRuntime(cwd),
    framework: detectFramework(cwd),
    monorepo: detectMonorepo(cwd),
  };
}

// ─── Config scanning ─────────────────────────────────────────────────────────

function scanManifests(cwd: string): ConfigFile[] {
  const found: ConfigFile[] = [];
  const seen = new Set<string>();

  for (const { file } of TIER1_PATTERNS) {
    const matches = findFiles(cwd, file, MANIFEST_DEPTH);
    for (const rel of matches) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      found.push({ path: rel, content: "", tier: 1 });
    }
  }

  // Sort by depth (shallower first), then alphabetical
  found.sort((a, b) => {
    const da = a.path.split("/").length;
    const db = b.path.split("/").length;
    return da !== db ? da - db : a.path.localeCompare(b.path);
  });

  // Apply caps: read top MAX_MANIFEST_READ, list the rest
  const toRead = found.slice(0, MAX_MANIFEST_READ);
  for (const cfg of toRead) {
    cfg.content = readFileSafe(path.join(cwd, cfg.path), MAX_FILE_LINES);
  }

  // Trim the rest to just paths (empty content signals "listed only")
  return found.slice(0, MAX_MANIFESTS);
}

function scanConfigs(cwd: string): ConfigFile[] {
  const found: ConfigFile[] = [];
  for (const file of TIER2_FILES) {
    // Search up to CONFIG_DEPTH levels
    const parts = file.split("/");
    const fileName = parts[parts.length - 1];
    const prefix = parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";

    if (prefix) {
      // Fixed path like "prisma/schema.prisma" — check directly
      if (fileExists(cwd, file)) {
        found.push({ path: file, content: readFileSafe(path.join(cwd, file), MAX_FILE_LINES), tier: 2 });
      }
    } else {
      // Search at root and 1 level deep
      const matches = findFiles(cwd, fileName, CONFIG_DEPTH);
      for (const rel of matches) {
        found.push({ path: rel, content: readFileSafe(path.join(cwd, rel), MAX_FILE_LINES), tier: 2 });
      }
    }
  }
  return found;
}

// ─── Summary composition ─────────────────────────────────────────────────────

function formatStackLine(stack: StackInfo): string {
  const parts = [stack.primary];
  if (stack.runtime && stack.runtime !== stack.primary) parts.push(`runtime: ${stack.runtime}`);
  if (stack.framework) parts.push(`framework: ${stack.framework}`);
  if (stack.monorepo) parts.push(`monorepo: ${stack.monorepo}`);
  return parts.join(", ");
}

function formatConfigs(configs: ConfigFile[]): string {
  const lines: string[] = [];
  const withContent = configs.filter((c) => c.content);
  const listedOnly = configs.filter((c) => !c.content);

  for (const cfg of withContent) {
    lines.push(`### ${cfg.path}`);
    lines.push("```");
    lines.push(cfg.content);
    lines.push("```");
    lines.push("");
  }

  if (listedOnly.length) {
    lines.push("### Also present (not read):");
    for (const cfg of listedOnly) lines.push(`- ${cfg.path}`);
  }

  return lines.join("\n");
}

function composeSummary(tree: string, stack: StackInfo, configs: ConfigFile[]): string {
  const sections: string[] = [];

  sections.push(`## Stack: ${formatStackLine(stack)}`);
  sections.push("");
  sections.push(`## Structure (depth ${TREE_DEPTH}):`);
  sections.push("```");
  sections.push(tree);
  sections.push("```");
  sections.push("");

  const tier1 = configs.filter((c) => c.tier === 1);
  const tier2 = configs.filter((c) => c.tier === 2);

  if (tier1.length) {
    sections.push("## Manifests:");
    sections.push(formatConfigs(tier1));
  }

  if (tier2.length) {
    sections.push("## Configuration:");
    sections.push(formatConfigs(tier2));
  }

  return sections.join("\n");
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function runGroundingDeterministic(input: GroundingInput): GroundingOutput {
  const { cwd } = input;
  const tree = buildTree(cwd);
  const stack = detectStack(cwd);
  const manifests = scanManifests(cwd);
  const configs = scanConfigs(cwd);
  const allConfigs = [...manifests, ...configs];
  const summary = composeSummary(tree, stack, allConfigs);

  return { tree, stack, configs: allConfigs, summary };
}
