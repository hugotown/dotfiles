/**
 * Agent Repository — Single source of truth for agent definitions.
 *
 * Architecture:
 *   - Repository pattern: hides discovery details from consumers
 *   - Strategy pattern: each IAgentLoader knows one source format/path
 *   - Singleton with explicit reload(): cheap repeated reads + manual refresh
 *
 * Resolution: lower priority number wins when two sources define the same name.
 * Local sources beat global sources; pi beats claude beats gemini beats codex.
 *
 * Cross-platform agent reuse (claude/gemini/codex) is read-only — fields not
 * present in their schemas (provider, thinking, tools) are inferred or left
 * undefined. Pi-native agents stay fully featured.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type ExecutorKind = "pi" | "claude-cli" | "opencode-cli";

export interface AgentDef {
  name: string;
  systemPrompt: string;
  provider?: string;
  model?: string;
  thinking?: string;
  tools?: string;
  description?: string;
  source: string;
  filePath: string;
  // Executor strategy — defaults to "pi". Pick based on which CLI you want to
  // delegate to (pi child process, anthropic claude CLI, opencode CLI).
  executor?: ExecutorKind;
  // Extra raw CLI arguments appended to the executor's command, space-separated.
  // Example: "--append-system-prompt-file /tmp/extra.md --plugin-dir ./plugins"
  executorArgs?: string;
}

export interface IAgentLoader {
  readonly source: string;
  readonly priority: number;
  discover(cwd: string): AgentDef[];
}

export interface ListedAgent {
  name: string;
  description: string;
  source: string;
  model?: string;
}

// ============================================================================
// SHARED FRONTMATTER PARSER
// Tolerant of single-line YAML (no nested objects, no multi-line values).
// Supports quoted strings, unquoted scalars, and YAML lists like [a, b, c].
// ============================================================================

export function parseFrontmatter(content: string): {
  meta: Record<string, string>;
  body: string;
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of fmMatch[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Flatten YAML list [a, b, c] → "a,b,c"
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .join(",");
    }
    meta[m[1]] = value;
  }
  return { meta, body: fmMatch[2].trim() };
}

// ============================================================================
// CONCRETE LOADERS (Strategy implementations)
// ============================================================================

abstract class FrontmatterDirLoader implements IAgentLoader {
  abstract readonly source: string;
  abstract readonly priority: number;
  protected abstract resolveDir(cwd: string): string;

  discover(cwd: string): AgentDef[] {
    const dir = this.resolveDir(cwd);
    if (!fs.existsSync(dir)) return [];
    const out: AgentDef[] = [];
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return [];
    }
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = path.join(dir, entry);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const { meta, body } = parseFrontmatter(raw);
        const name = meta.name || path.basename(entry, ".md");
        const rawExecutor = meta.executor as string | undefined;
        const executor: ExecutorKind | undefined =
          rawExecutor === "claude-cli" || rawExecutor === "opencode-cli" || rawExecutor === "pi"
            ? rawExecutor
            : undefined;
        out.push({
          name,
          systemPrompt: body,
          provider: meta.provider,
          model: meta.model,
          thinking: meta.thinking,
          tools: meta.tools,
          description: meta.description,
          source: this.source,
          filePath,
          executor,
          executorArgs: meta.executorArgs,
        });
      } catch {
        // Skip unreadable / malformed files silently — discovery must never throw
      }
    }
    return out;
  }
}

class PiLocalLoader extends FrontmatterDirLoader {
  readonly source = "pi-local";
  readonly priority = 10;
  protected resolveDir(cwd: string) { return path.join(cwd, ".pi", "agents"); }
}
class PiGlobalLoader extends FrontmatterDirLoader {
  readonly source = "pi-global";
  readonly priority = 50;
  protected resolveDir() { return path.join(os.homedir(), ".pi", "agent", "agents"); }
}
class ClaudeLocalLoader extends FrontmatterDirLoader {
  readonly source = "claude-local";
  readonly priority = 20;
  protected resolveDir(cwd: string) { return path.join(cwd, ".claude", "agents"); }
}
class ClaudeGlobalLoader extends FrontmatterDirLoader {
  readonly source = "claude-global";
  readonly priority = 60;
  protected resolveDir() { return path.join(os.homedir(), ".claude", "agents"); }
}
class GeminiLocalLoader extends FrontmatterDirLoader {
  readonly source = "gemini-local";
  readonly priority = 30;
  protected resolveDir(cwd: string) { return path.join(cwd, ".gemini", "agents"); }
}
class GeminiGlobalLoader extends FrontmatterDirLoader {
  readonly source = "gemini-global";
  readonly priority = 70;
  protected resolveDir() { return path.join(os.homedir(), ".gemini", "agents"); }
}
class CodexLocalLoader extends FrontmatterDirLoader {
  readonly source = "codex-local";
  readonly priority = 40;
  protected resolveDir(cwd: string) { return path.join(cwd, ".codex", "agents"); }
}
class CodexGlobalLoader extends FrontmatterDirLoader {
  readonly source = "codex-global";
  readonly priority = 80;
  protected resolveDir() { return path.join(os.homedir(), ".codex", "agents"); }
}

// ============================================================================
// REPOSITORY (Singleton facade)
// ============================================================================

class AgentRepository {
  private agents: Map<string, AgentDef> = new Map();
  private loaders: IAgentLoader[] = [
    new PiLocalLoader(),
    new ClaudeLocalLoader(),
    new GeminiLocalLoader(),
    new CodexLocalLoader(),
    new PiGlobalLoader(),
    new ClaudeGlobalLoader(),
    new GeminiGlobalLoader(),
    new CodexGlobalLoader(),
  ];
  private lastCwd: string = process.cwd();

  registerLoader(loader: IAgentLoader): void {
    this.loaders.push(loader);
    this.loaders.sort((a, b) => a.priority - b.priority);
  }

  reload(cwd?: string): void {
    if (cwd) this.lastCwd = cwd;
    this.agents.clear();
    // Sorted loaders run lowest priority first; earlier insert wins (Map.set)
    const sorted = [...this.loaders].sort((a, b) => a.priority - b.priority);
    for (const loader of sorted) {
      for (const def of loader.discover(this.lastCwd)) {
        if (!this.agents.has(def.name)) {
          this.agents.set(def.name, def);
        }
      }
    }
  }

  find(name: string): AgentDef | null {
    if (this.agents.size === 0) this.reload();
    return this.agents.get(name) ?? null;
  }

  list(): ListedAgent[] {
    if (this.agents.size === 0) this.reload();
    return [...this.agents.values()].map((a) => ({
      name: a.name,
      description: a.description ?? "",
      source: a.source,
      model: a.model,
    }));
  }

  groupedBySource(): Record<string, ListedAgent[]> {
    if (this.agents.size === 0) this.reload();
    const out: Record<string, ListedAgent[]> = {};
    for (const a of this.agents.values()) {
      (out[a.source] ??= []).push({
        name: a.name,
        description: a.description ?? "",
        source: a.source,
        model: a.model,
      });
    }
    return out;
  }
}

const repository = new AgentRepository();
export function getAgentRepository(): AgentRepository {
  return repository;
}

// No-op default export so Pi's extension auto-loader accepts this file as a
// valid (inert) extension. The real consumers import named exports above.
export default function () { /* library module — no extension behavior */ }
