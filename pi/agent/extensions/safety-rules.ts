/**
 * Safety Rules — Declarative damage control via YAML
 *
 * Reads ~/.pi/agent/safety.yaml (and project-local .pi/safety.yaml that
 * overrides per-rule) and intercepts tool_call events to enforce rules.
 *
 * Architecture:
 *   - Specification pattern: each rule is a Specification<ToolCallContext>
 *   - Interceptor pattern: tool_call hook evaluates all specs, returns
 *     {block: true} for the first hit (Chain of Responsibility)
 *   - Strategy: each spec type knows how to match its inputs (path, regex)
 *
 * YAML schema (~/.pi/agent/safety.yaml):
 *   zeroAccessPaths:               # block read+write+edit+bash touching these
 *     - ~/.ssh
 *     - /etc/passwd
 *     - "**​/.env"
 *   readOnlyPaths:                 # block write/edit, allow read
 *     - package.json
 *     - "*.lock"
 *   noDeletePaths:                 # block bash patterns that delete these
 *     - ~/Documents/**
 *   bashToolPatterns:
 *     - pattern: "rm -rf"
 *       reason: "Destructive recursive delete"
 *       ask: true                  # true → ctx.ui.confirm; false → block hard
 *     - pattern: "git push --force"
 *       reason: "Force push rewrites remote history"
 *       ask: true
 *
 * Globs: minimal subset — `*` matches single segment (no /), `**` matches any.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { parseYaml } from "./yaml-mini.ts";

// ============================================================================
// TYPES
// ============================================================================

interface BashRule {
  pattern: string;
  reason: string;
  ask?: boolean;
}

interface SafetyConfig {
  zeroAccessPaths: string[];
  readOnlyPaths: string[];
  noDeletePaths: string[];
  bashToolPatterns: BashRule[];
}

interface ToolCallContext {
  toolName: string;
  input: Record<string, unknown>;
  resolvedPath?: string;
  command?: string;
}

interface RuleVerdict {
  block: boolean;
  reason: string;
  ask: boolean;
}

interface Specification {
  evaluate(call: ToolCallContext): RuleVerdict | null;
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

function expandTilde(p: string): string {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

function loadConfig(cwd: string): SafetyConfig {
  const merged: SafetyConfig = {
    zeroAccessPaths: [],
    readOnlyPaths: [],
    noDeletePaths: [],
    bashToolPatterns: [],
  };
  const sources = [
    path.join(os.homedir(), ".pi", "agent", "safety.yaml"),
    path.join(cwd, ".pi", "safety.yaml"),
  ];
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    try {
      const raw = fs.readFileSync(src, "utf-8");
      const parsed = parseYaml(raw) as Partial<SafetyConfig> | null;
      if (!parsed || typeof parsed !== "object") continue;
      if (Array.isArray(parsed.zeroAccessPaths)) merged.zeroAccessPaths.push(...parsed.zeroAccessPaths.map(String));
      if (Array.isArray(parsed.readOnlyPaths)) merged.readOnlyPaths.push(...parsed.readOnlyPaths.map(String));
      if (Array.isArray(parsed.noDeletePaths)) merged.noDeletePaths.push(...parsed.noDeletePaths.map(String));
      if (Array.isArray(parsed.bashToolPatterns)) {
        for (const r of parsed.bashToolPatterns) {
          if (r && typeof (r as BashRule).pattern === "string" && typeof (r as BashRule).reason === "string") {
            merged.bashToolPatterns.push({
              pattern: (r as BashRule).pattern,
              reason: (r as BashRule).reason,
              ask: Boolean((r as BashRule).ask),
            });
          }
        }
      }
    } catch { /* skip malformed */ }
  }
  return merged;
}

// ============================================================================
// GLOB MATCHING (minimal)
// `**` matches any path segments (or empty). `*` matches a single segment.
// Anchored: pattern must match the full normalized path.
// ============================================================================

function compileGlob(glob: string): RegExp {
  const expanded = path.resolve(expandTilde(glob));
  // Escape regex metacharacters except * and /
  const escaped = expanded.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // Replace ** first (any chars), then single * (no slash)
  const pattern = escaped
    .replace(/\*\*/g, "§§DOUBLESTAR§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§DOUBLESTAR§§/g, ".*");
  return new RegExp("^" + pattern + "$");
}

function matchesAny(target: string, globs: string[]): string | null {
  const normalized = path.resolve(target);
  for (const g of globs) {
    if (compileGlob(g).test(normalized)) return g;
  }
  return null;
}

// ============================================================================
// SPECIFICATIONS (Strategy pattern)
// ============================================================================

class ZeroAccessSpec implements Specification {
  constructor(private paths: string[]) {}
  evaluate(call: ToolCallContext): RuleVerdict | null {
    if (!call.resolvedPath) return null;
    const hit = matchesAny(call.resolvedPath, this.paths);
    return hit ? { block: true, ask: false, reason: `Zero-access path: ${hit}` } : null;
  }
}

class ReadOnlySpec implements Specification {
  constructor(private paths: string[]) {}
  evaluate(call: ToolCallContext): RuleVerdict | null {
    if (!call.resolvedPath) return null;
    const isWrite = call.toolName === "write" || call.toolName === "edit";
    if (!isWrite) return null;
    const hit = matchesAny(call.resolvedPath, this.paths);
    return hit ? { block: true, ask: false, reason: `Read-only path (write blocked): ${hit}` } : null;
  }
}

class NoDeleteSpec implements Specification {
  // Detect bash deletion intents touching protected paths
  private deletePatterns = [/\brm\b/, /\bunlink\b/, /\brmdir\b/];
  constructor(private paths: string[]) {}
  evaluate(call: ToolCallContext): RuleVerdict | null {
    if (call.toolName !== "bash" || !call.command) return null;
    const looksDelete = this.deletePatterns.some((p) => p.test(call.command!));
    if (!looksDelete) return null;
    for (const protectedGlob of this.paths) {
      const expanded = expandTilde(protectedGlob).replace(/\*+/g, "");
      if (call.command.includes(expanded)) {
        return { block: true, ask: false, reason: `Delete blocked on protected path: ${protectedGlob}` };
      }
    }
    return null;
  }
}

class BashPatternSpec implements Specification {
  constructor(private rules: BashRule[]) {}
  evaluate(call: ToolCallContext): RuleVerdict | null {
    if (call.toolName !== "bash" || !call.command) return null;
    for (const rule of this.rules) {
      if (call.command.includes(rule.pattern)) {
        return { block: true, ask: Boolean(rule.ask), reason: rule.reason };
      }
    }
    return null;
  }
}

// ============================================================================
// EVALUATOR (Chain of Responsibility)
// ============================================================================

class SafetyEvaluator {
  constructor(private specs: Specification[]) {}
  evaluate(call: ToolCallContext): RuleVerdict | null {
    for (const spec of this.specs) {
      const v = spec.evaluate(call);
      if (v) return v;
    }
    return null;
  }
}

function buildEvaluator(cfg: SafetyConfig): SafetyEvaluator {
  return new SafetyEvaluator([
    new ZeroAccessSpec(cfg.zeroAccessPaths),
    new ReadOnlySpec(cfg.readOnlyPaths),
    new NoDeleteSpec(cfg.noDeletePaths),
    new BashPatternSpec(cfg.bashToolPatterns),
  ]);
}

// ============================================================================
// TOOL CALL CONTEXT EXTRACTION
// Pulls path/command from the well-known shapes of read/write/edit/bash.
// ============================================================================

function extractContext(event: unknown, ctx: ExtensionContext): ToolCallContext | null {
  const ev = event as { toolName?: string; input?: Record<string, unknown> };
  if (!ev.toolName || !ev.input) return null;
  const base: ToolCallContext = { toolName: ev.toolName, input: ev.input };

  if (isToolCallEventType("read", event as never) || isToolCallEventType("write", event as never) || isToolCallEventType("edit", event as never)) {
    const p = (ev.input as { path?: string }).path;
    if (typeof p === "string") base.resolvedPath = path.resolve(ctx.cwd, p);
  }
  if (isToolCallEventType("bash", event as never)) {
    const cmd = (ev.input as { command?: string }).command;
    if (typeof cmd === "string") base.command = cmd;
  }
  return base;
}

// ============================================================================
// EXTENSION ENTRY POINT
// ============================================================================

export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  let evaluator: SafetyEvaluator | null = null;
  let cfgSummary = "no safety.yaml found";

  function reloadConfig(cwd: string): void {
    const cfg = loadConfig(cwd);
    evaluator = buildEvaluator(cfg);
    const totalRules =
      cfg.zeroAccessPaths.length + cfg.readOnlyPaths.length + cfg.noDeletePaths.length + cfg.bashToolPatterns.length;
    cfgSummary = totalRules > 0
      ? `${cfg.zeroAccessPaths.length} zero-access · ${cfg.readOnlyPaths.length} read-only · ${cfg.noDeletePaths.length} no-delete · ${cfg.bashToolPatterns.length} bash patterns`
      : "no rules defined";
  }

  pi.registerCommand("safety", {
    description: "Show or reload safety rules",
    handler: async (args, ctx) => {
      const arg = (args ?? "").trim();
      if (arg === "reload") {
        reloadConfig(ctx.cwd);
        ctx.ui.notify(`Safety rules reloaded: ${cfgSummary}`, "success");
        return;
      }
      ctx.ui.notify(
        `Safety rules (${cfgSummary})\nFiles checked:\n  ~/.pi/agent/safety.yaml\n  ${ctx.cwd}/.pi/safety.yaml\nCommands: /safety reload`,
        "info"
      );
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!evaluator) reloadConfig(ctx.cwd);
    if (!evaluator) return;

    const callCtx = extractContext(event, ctx);
    if (!callCtx) return;

    const verdict = evaluator.evaluate(callCtx);
    if (!verdict) return;

    if (verdict.ask) {
      const ok = await ctx.ui.confirm("⚠️ Safety rule triggered", `${verdict.reason}\n\n¿Permitir esta acción?`);
      if (!ok) return { block: true, reason: `User declined: ${verdict.reason}` };
      return; // User approved
    }
    return { block: true, reason: verdict.reason };
  });

  pi.on("session_start", async (_event, ctx) => {
    reloadConfig(ctx.cwd);
    if (cfgSummary !== "no safety.yaml found" && cfgSummary !== "no rules defined") {
      ctx.ui.notify(`Safety rules activas: ${cfgSummary}`, "info");
    }
  });
}
