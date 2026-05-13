/**
 * Chains — Sequential agent pipelines (Pipes & Filters architecture)
 *
 * A chain is an ordered list of steps. Each step targets one agent and renders
 * a prompt template that has access to:
 *   $INPUT     — output of the previous step (= original task on step 1)
 *   $ORIGINAL  — the user's original task (constant across the chain)
 *   $1, $2...  — positional words from the original task
 *   $@ / $ARGUMENTS — the full original task
 *
 * Chain definitions live in YAML at:
 *   ~/.pi/agent/chains/<name>.yaml          (global)
 *   <cwd>/.pi/chains/<name>.yaml            (project)
 *
 * Project chains override global on name conflict.
 *
 * Architecture:
 *   - VariableExpander: pure function, easily testable
 *   - ChainRepository: discovers + parses chain YAMLs (Strategy + Repository)
 *   - executeChain(): orchestrator (Pipes & Filters), reuses spawnOnce() from
 *     subagents.ts so persistence/widget/registry behavior is identical
 *
 * Triggers:
 *   - Tool:  run_chain (LLM-driven)
 *   - Flag:  --chain <name> "<task>"  (deterministic)
 *   - Slash: /chains  (list + select)
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawnOnce, type SubagentResult } from "./subagents.ts";
import { parseYaml } from "./yaml-mini.ts";

// ============================================================================
// TYPES
// ============================================================================

interface ChainStep {
  agent: string;
  prompt: string;
  cwd?: string;
  thinking?: string;
}

interface ChainDef {
  name: string;
  description: string;
  steps: ChainStep[];
  source: string;
  filePath: string;
}

interface ChainExecutionResult {
  chainName: string;
  steps: SubagentResult[];
  finalOutput: string;
  success: boolean;
  totalDurationMs: number;
}

// ============================================================================
// VARIABLE EXPANDER (pure)
// Resolves $INPUT, $ORIGINAL, $@, $ARGUMENTS, $1...$N in a template.
// ============================================================================

function expandVariables(template: string, vars: { input: string; original: string }): string {
  const args = vars.original.split(/\s+/).filter(Boolean);
  let out = template
    .replace(/\$INPUT\b/g, vars.input)
    .replace(/\$ORIGINAL\b/g, vars.original)
    .replace(/\$ARGUMENTS\b/g, vars.original)
    .replace(/\$@/g, vars.original);
  for (let i = 0; i < args.length; i++) {
    out = out.replaceAll(`$${i + 1}`, args[i]);
  }
  return out;
}

// ============================================================================
// CHAIN REPOSITORY (Repository pattern, lazy reload)
// ============================================================================

class ChainRepository {
  private chains: Map<string, ChainDef> = new Map();
  private lastCwd: string = process.cwd();

  reload(cwd?: string): void {
    if (cwd) this.lastCwd = cwd;
    this.chains.clear();
    // Load order: project beats global
    this.loadFromDir(path.join(os.homedir(), ".pi", "agent", "chains"), "global");
    this.loadFromDir(path.join(this.lastCwd, ".pi", "chains"), "project");
  }

  list(): ChainDef[] {
    if (this.chains.size === 0) this.reload();
    return [...this.chains.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  find(name: string): ChainDef | null {
    if (this.chains.size === 0) this.reload();
    return this.chains.get(name) ?? null;
  }

  private loadFromDir(dir: string, source: string): void {
    if (!fs.existsSync(dir)) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
      const filePath = path.join(dir, entry);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = this.parseChainYaml(raw, filePath, source);
        if (parsed) this.chains.set(parsed.name, parsed); // project overwrites global since loaded after
      } catch {
        // Skip malformed chain files silently
      }
    }
  }

  private parseChainYaml(raw: string, filePath: string, source: string): ChainDef | null {
    let parsed: { name?: string; description?: string; steps?: unknown };
    try {
      parsed = parseYaml(raw) as typeof parsed;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const name = parsed.name ?? path.basename(filePath, path.extname(filePath));
    if (!Array.isArray(parsed.steps)) return null;

    const steps: ChainStep[] = [];
    for (const s of parsed.steps as Array<Record<string, unknown>>) {
      if (typeof s.agent !== "string" || typeof s.prompt !== "string") continue;
      steps.push({
        agent: s.agent,
        prompt: s.prompt,
        cwd: typeof s.cwd === "string" ? s.cwd : undefined,
        thinking: typeof s.thinking === "string" ? s.thinking : undefined,
      });
    }
    if (steps.length === 0) return null;

    return {
      name,
      description: typeof parsed.description === "string" ? parsed.description : "",
      steps,
      source,
      filePath,
    };
  }
}

const chainRepo = new ChainRepository();

// ============================================================================
// CHAIN EXECUTOR (Pipes & Filters orchestrator)
// ============================================================================

async function executeChain(
  chain: ChainDef,
  task: string,
  ctx: ExtensionContext,
  thinkingOverride?: string
): Promise<ChainExecutionResult> {
  const startedAt = Date.now();
  const chainRunId = randomUUID().slice(0, 8);
  const stepResults: SubagentResult[] = [];
  let input = task;
  const original = task;

  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    const resolvedPrompt = expandVariables(step.prompt, { input, original });
    const runRef = `chain-${chainRunId}#${i}`;

    // Each chain step uses its own session file under the parent's session dir
    const sm = ctx.sessionManager as unknown as { getSessionFile?: () => string | undefined };
    const parentSession = sm.getSessionFile?.();
    const baseName = parentSession ? path.basename(parentSession, ".jsonl") : "ephemeral";
    const sessionsDir = parentSession ? path.dirname(parentSession) : path.join(os.homedir(), ".pi", "agent", "sessions");
    const stepDir = path.join(sessionsDir, baseName, `chain-${chainRunId}`);
    fs.mkdirSync(stepDir, { recursive: true });
    const sessionFile = path.join(stepDir, `step${i}-${step.agent}.jsonl`);

    const result = await spawnOnce({
      task: resolvedPrompt,
      agent: step.agent,
      cwd: step.cwd,
      thinkingOverride: step.thinking ?? thinkingOverride,
      sessionFile,
      runRef,
      ctx,
    });

    stepResults.push(result);

    if (result.exitCode !== 0) {
      return {
        chainName: chain.name,
        steps: stepResults,
        finalOutput: result.output,
        success: false,
        totalDurationMs: Date.now() - startedAt,
      };
    }
    input = result.output;
  }

  return {
    chainName: chain.name,
    steps: stepResults,
    finalOutput: input,
    success: true,
    totalDurationMs: Date.now() - startedAt,
  };
}

function formatChainResult(r: ChainExecutionResult): string {
  const lines: string[] = [];
  const status = r.success ? "✓" : "✗";
  lines.push(`## Chain: ${r.chainName} ${status} — ${r.steps.length} step(s), ${(r.totalDurationMs / 1000).toFixed(1)}s total`);
  lines.push("");
  for (let i = 0; i < r.steps.length; i++) {
    const s = r.steps[i];
    const sym = s.exitCode === 0 ? "✓" : "✗";
    lines.push(`### Step ${i + 1}: ${sym} @${s.agent} · ${(s.durationMs / 1000).toFixed(1)}s`);
    lines.push("");
    lines.push(s.output);
    lines.push("");
    if (s.error) {
      lines.push(`**Error:** ${s.error}`);
      lines.push("");
    }
  }
  if (r.success) {
    lines.push("---");
    lines.push("**Final output (last step):**");
    lines.push("");
    lines.push(r.finalOutput);
  } else {
    lines.push("---");
    lines.push(`⚠️ Chain stopped at step ${r.steps.length} due to error.`);
  }
  return lines.join("\n");
}

// ============================================================================
// FLAG PARSER for --chain <name> "<task>"
// ============================================================================

interface ParsedChainFlag {
  chainName: string;
  task: string;
  cleanPrompt: string;
}

function parseChainFlag(prompt: string): ParsedChainFlag | null {
  const m = prompt.match(/(^|\s)--chain\s+([\w-]+)\s+(?:"([^"]*)"|'([^']*)'|(\S.*))$/);
  if (!m) return null;
  const chainName = m[2];
  const task = m[3] ?? m[4] ?? m[5] ?? "";
  if (!task.trim()) return null;
  const cleanPrompt = prompt.slice(0, m.index! + m[1].length).trim();
  return { chainName, task: task.trim(), cleanPrompt };
}

// ============================================================================
// EXTENSION ENTRY POINT
// ============================================================================

export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  // ---- Tool: run_chain (LLM-driven) ----------------------------------------
  pi.registerTool({
    name: "run_chain",
    label: "Run Chain",
    description:
      "Execute a predefined sequential chain of agents. Each step's output becomes the next step's $INPUT. " +
      "Use this when a workflow is repeatable and the user has a chain defined (list with /chains). " +
      "Pass the chainName and the user's original task; chain templates handle composition.",
    promptSnippet: "Run a predefined sequential agent pipeline (chain) for repeatable workflows",
    promptGuidelines: [
      "Use run_chain when a named chain matches the user's request and the chain is registered (check /chains).",
    ],
    parameters: Type.Object({
      chainName: Type.String({ description: "Name of the chain (file basename without .yaml)" }),
      task: Type.String({ description: "Original user task that flows through the chain as $ORIGINAL and the first $INPUT" }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled before start" }], details: {} };
      chainRepo.reload(ctx.cwd);
      const chain = chainRepo.find(params.chainName);
      if (!chain) {
        const available = chainRepo.list().map((c) => c.name).join(", ") || "(none)";
        return {
          content: [{ type: "text", text: `Chain "${params.chainName}" not found. Available: ${available}` }],
          details: {},
        };
      }
      const result = await executeChain(chain, params.task, ctx);
      return {
        content: [{ type: "text", text: formatChainResult(result) }],
        details: {
          chainName: result.chainName,
          success: result.success,
          totalDurationMs: result.totalDurationMs,
          stepCount: result.steps.length,
        },
      };
    },
  });

  // ---- Slash: /chains  (list available chains) -----------------------------
  pi.registerCommand("chains", {
    description: "List available chains (~/.pi/agent/chains/ + .pi/chains/)",
    handler: async (_args, ctx) => {
      chainRepo.reload(ctx.cwd);
      const chains = chainRepo.list();
      if (chains.length === 0) {
        ctx.ui.notify(
          "No chains defined. Create one at ~/.pi/agent/chains/<name>.yaml with format:\nname: my-chain\ndescription: ...\nsteps:\n  - agent: plan\n    prompt: \"Plan: $INPUT\"\n  - agent: build\n    prompt: \"Implement plan:\\n$INPUT\"",
          "info"
        );
        return;
      }
      const lines = chains.map((c) => `  ${c.name.padEnd(20)} (${c.steps.length} steps, ${c.source})${c.description ? ` — ${c.description}` : ""}`);
      ctx.ui.notify(`Available chains (${chains.length}):\n${lines.join("\n")}`, "info");
    },
  });

  // ---- Slash: /chain <name> <task>  (run a chain directly) -----------------
  pi.registerCommand("chain", {
    description: "Run a chain directly. Usage: /chain <name> <task>",
    handler: async (args, ctx) => {
      const trimmed = (args ?? "").trim();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx === -1) {
        ctx.ui.notify("Uso: /chain <name> <task>", "warning");
        return;
      }
      const chainName = trimmed.slice(0, spaceIdx);
      const task = trimmed.slice(spaceIdx + 1).trim();
      chainRepo.reload(ctx.cwd);
      const chain = chainRepo.find(chainName);
      if (!chain) {
        ctx.ui.notify(`Chain "${chainName}" no encontrada. Usa /chains.`, "error");
        return;
      }
      const result = await executeChain(chain, task, ctx);
      ctx.ui.notify(
        `Chain ${chainName} ${result.success ? "✓" : "✗"} — ${result.steps.length} steps in ${(result.totalDurationMs / 1000).toFixed(1)}s`,
        result.success ? "success" : "error"
      );
    },
  });

  // ---- Trigger: --chain flag handler in flags-gateway ----------------------
  import("./flags-gateway.js")
    .then(({ registerFlagHandler }) => {
      registerFlagHandler(pi, {
        match: (prompt: string) => parseChainFlag(prompt),
        priority: 850,
        execute: async (state, ctx, _piApi, parsed: ParsedChainFlag) => {
          chainRepo.reload(ctx.cwd);
          const chain = chainRepo.find(parsed.chainName);
          if (!chain) {
            state.systemInjections.push(
              `**--chain error:** chain "${parsed.chainName}" not found. Available: ${chainRepo.list().map((c) => c.name).join(", ") || "(none)"}`
            );
            return;
          }
          state.cleanPrompt = parsed.cleanPrompt;
          const result = await executeChain(chain, parsed.task, ctx, state.thinking ?? undefined);
          state.systemInjections.push(formatChainResult(result));
        },
      });
    })
    .catch(() => { /* flags-gateway absent; chain flag silently disabled */ });

  pi.on("session_start", async (_event, ctx) => {
    fs.mkdirSync(path.join(os.homedir(), ".pi", "agent", "chains"), { recursive: true });
    chainRepo.reload(ctx.cwd);
    const count = chainRepo.list().length;
    if (count > 0) {
      ctx.ui.notify(`Chains cargadas (${count}). Usa /chains para listar o --chain <name> "<task>"`, "info");
    }
  });
}
