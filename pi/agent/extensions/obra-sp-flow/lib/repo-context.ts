// Deterministic "repo context pack" built by CODE (not the LLM): a depth-capped
// file tree, the detected stack, and a public-symbol outline extracted with
// ast-grep. Injected into each LLM phase so subagents trust this map instead of
// re-exploring the codebase from scratch (the redundant cost C1 measures).
//
// Everything degrades gracefully: any missing tool (eza/ast-grep) or unsupported
// language yields an empty section, never an error. Built fresh per phase (cheap
// local CLIs), mirroring skill-loader's read-from-disk philosophy.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { detectLint, detectTest, detectTypecheck } from "./detect.ts";

export interface RepoContext {
  tree: string;
  stack: string;
  symbols: string;
}

interface LangSpec {
  lang: string;
  kinds: string[];
}

const TREE_CAP = 2500;
const SYMBOLS_CAP = 3000;
const SIG_CAP = 160;
const PRUNE = "node_modules|.git|dist|build|coverage|.next|out|target|vendor";

/** Run a command, returning stdout or "" on any failure (non-zero, timeout). */
function sh(cwd: string, cmd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 20_000, maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return "";
  }
}

function exists(cwd: string, f: string): boolean {
  return fs.existsSync(path.join(cwd, f));
}

function cap(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}\n… (truncated)`;
}

function repoTree(cwd: string): string {
  const eza = sh(cwd, `eza -T -L 2 --git-ignore --group-directories-first -I "${PRUNE}" .`);
  if (eza.trim()) return cap(eza.trim(), TREE_CAP);
  // Fallback when eza is absent.
  const find = sh(cwd, `find . -maxdepth 2 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort`);
  return cap(find.trim(), TREE_CAP);
}

/** Languages to outline, keyed off the project's manifests. TS/JS is verified;
 *  python/go/rust kinds are best-effort and simply yield nothing if unmatched. */
function detectLangs(cwd: string): LangSpec[] {
  const out: LangSpec[] = [];
  if (exists(cwd, "tsconfig.json") || exists(cwd, "package.json")) {
    out.push({ lang: "ts", kinds: ["export_statement"] });
    out.push({ lang: "tsx", kinds: ["export_statement"] });
  }
  if (exists(cwd, "pyproject.toml") || exists(cwd, "setup.py") || exists(cwd, "requirements.txt") || exists(cwd, "pytest.ini")) {
    out.push({ lang: "python", kinds: ["function_definition", "class_definition"] });
  }
  if (exists(cwd, "go.mod")) {
    out.push({ lang: "go", kinds: ["function_declaration", "method_declaration", "type_declaration"] });
  }
  if (exists(cwd, "Cargo.toml")) {
    out.push({ lang: "rust", kinds: ["function_item", "struct_item", "enum_item", "trait_item"] });
  }
  return out;
}

function repoStack(cwd: string): string {
  const parts: string[] = [];
  const manifests = ["package.json", "tsconfig.json", "pyproject.toml", "go.mod", "Cargo.toml", "deno.json"].filter((f) => exists(cwd, f));
  if (manifests.length) parts.push(`Manifests: ${manifests.join(", ")}`);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    if (pkg.name) parts.push(`Package: ${pkg.name}`);
    if (pkg.scripts && typeof pkg.scripts === "object") parts.push(`Scripts: ${Object.keys(pkg.scripts).join(", ")}`);
  } catch {
    /* no package.json */
  }
  const checks = [
    detectTypecheck(cwd) && `typecheck: ${detectTypecheck(cwd)}`,
    detectLint(cwd) && `lint: ${detectLint(cwd)}`,
    detectTest(cwd) && `test: ${detectTest(cwd)}`,
  ].filter(Boolean);
  if (checks.length) parts.push(`Checks → ${checks.join(" | ")}`);
  return parts.join("\n");
}

function isTestFile(file: string): boolean {
  return /(^|\/)(tests?|__tests__)\//.test(file) || /\.(test|spec)\./.test(file);
}

function repoSymbols(cwd: string, langs: LangSpec[]): string {
  const byFile = new Map<string, Set<string>>();
  for (const { lang, kinds } of langs) {
    for (const kind of kinds) {
      const raw = sh(cwd, `ast-grep run --kind ${kind} -l ${lang} --json=compact .`);
      if (!raw.trim()) continue;
      let matches: Array<{ file?: string; lines?: string; range?: { start?: { column?: number } } }>;
      try {
        matches = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const m of matches) {
        if (!m.file || !m.lines || m.range?.start?.column !== 0 || isTestFile(m.file)) continue;
        const sig = m.lines.split("\n")[0].replace(/\s*\{\s*$/, "").trim();
        if (!sig) continue;
        const set = byFile.get(m.file) ?? new Set<string>();
        set.add(sig.length > SIG_CAP ? `${sig.slice(0, SIG_CAP)}…` : sig);
        byFile.set(m.file, set);
      }
    }
  }
  const lines: string[] = [];
  for (const [file, sigs] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${file}:`);
    for (const s of sigs) lines.push(`  ${s}`);
  }
  return cap(lines.join("\n"), SYMBOLS_CAP);
}

export function buildRepoContext(cwd: string): RepoContext {
  return { tree: repoTree(cwd), stack: repoStack(cwd), symbols: repoSymbols(cwd, detectLangs(cwd)) };
}

/** Render the pack as a prompt block, or "" when nothing could be extracted. */
export function renderRepoContext(rc: RepoContext): string {
  const blocks: string[] = [];
  if (rc.stack) blocks.push(`### Stack\n${rc.stack}`);
  if (rc.tree) blocks.push(`### File tree (depth 2)\n\`\`\`\n${rc.tree}\n\`\`\``);
  if (rc.symbols) blocks.push(`### Public symbols (precomputed outline)\n\`\`\`\n${rc.symbols}\n\`\`\``);
  if (!blocks.length) return "";
  return [
    "## Repository context (precomputed — trust this map)",
    "Extracted deterministically by the orchestrator. Treat it as ground truth for layout, stack, and existing public API. Read files or run ast-grep ONLY for specifics this map omits — do not re-derive the structure.",
    ...blocks,
  ].join("\n\n");
}

/** Convenience: build + render in one call. */
export function repoContextBlock(cwd: string): string {
  return renderRepoContext(buildRepoContext(cwd));
}
