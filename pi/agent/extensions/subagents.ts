/**
 * Subagents — Multi-trigger orchestrator for Pi child processes.
 *
 * Architecture:
 *   - Engine: spawnOnce() (low-level, exported for chains.ts to reuse)
 *             → spawnSubagents() (high-level, parallel/sequential)
 *   - Triggers (multiple paths to same engine — Strategy):
 *     - Tool: spawn_subagent (LLM-driven)
 *     - Flag: --sub (deterministic, parsed in flags-gateway)
 *     - Tool: continue_subagent (LLM-driven session resume)
 *     - Slash: /subcont, /sublist, /subkill, /agents (user-driven)
 *   - State: PersistedRunRegistry (Singleton, in-memory cross-turn)
 *   - UI: GridWidget renders one card per active subagent (Composite)
 *   - Dispatch-only mode: --dispatch-only flag injects strong system prompt
 *     forbidding direct tool use, telling the LLM to delegate everything.
 *
 * Persistent sessions:
 *   Each spawned child gets a session file at
 *     ~/.pi/agent/sessions/<parent>/<runId>/<agent>.jsonl
 *   The sessionFile is recorded in PersistedRunRegistry so /subcont and
 *   continue_subagent can re-spawn the same pi process with --session
 *   pointing to the same JSONL → child resumes its prior conversation.
 *
 * Recursion guard: PI_SUBAGENT_CHILD=1 in env → registration skipped, so
 * subagents cannot recursively spawn more subagents (prevents fork bombs).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component, type Theme } from "@mariozechner/pi-tui";
import { getAgentRepository, type AgentDef } from "./agent-repository.ts";

// ============================================================================
// PUBLIC TYPES (exported so chains.ts can reuse the engine)
// ============================================================================

export interface SubagentTask {
  agent?: string;
  prompt: string;
  cwd?: string;
}

export interface SpawnInput {
  tasks: SubagentTask[];
  parallel: boolean;
  thinkingOverride?: string;
  resumeSessionFile?: string; // For continue_subagent / /subcont
}

export interface SubagentResult {
  agent: string;
  task: string;
  output: string;
  exitCode: number;
  durationMs: number;
  error?: string;
  sessionFile?: string;
  runRef?: string; // Stable handle for /subcont (e.g. "a8e71d63#0")
}

export interface SpawnOutput {
  results: SubagentResult[];
  totalDurationMs: number;
  runId: string;
}

// ============================================================================
// PERSISTED RUN REGISTRY (Singleton, in-memory)
// Survives across turns within one pi session, lost on shutdown.
// ============================================================================

interface PersistedRun {
  runRef: string;
  agentName: string;
  sessionFile: string;
  cwd: string;
  createdAt: number;
  lastTask: string;
  lastOutput: string;
  lastDurationMs: number;
  turnCount: number;
  status: "idle" | "running" | "done" | "error";
  proc?: ChildProcess; // Set while running, cleared on close
}

class PersistedRunRegistry {
  private runs: Map<string, PersistedRun> = new Map();

  upsert(run: PersistedRun): void { this.runs.set(run.runRef, run); }
  get(ref: string): PersistedRun | null { return this.runs.get(ref) ?? null; }
  remove(ref: string): boolean { return this.runs.delete(ref); }
  list(): PersistedRun[] {
    return [...this.runs.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
  killAll(): void {
    for (const r of this.runs.values()) {
      try { r.proc?.kill("SIGTERM"); } catch { /* ignore */ }
    }
    this.runs.clear();
  }
}

const registry = new PersistedRunRegistry();

// ============================================================================
// LIVE PROGRESS STATE (per active spawn batch — drives the grid widget)
// ============================================================================

interface LiveCard {
  runRef: string;
  agentName: string;
  task: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs: number;
  toolCount: number;
  lastTool?: string;
  lastOutput?: string;
}

class LiveProgressBus {
  private cards: Map<string, LiveCard> = new Map();
  private subscribers: Set<() => void> = new Set();
  private clearTimer?: NodeJS.Timeout;

  put(card: LiveCard): void {
    this.cards.set(card.runRef, card);
    this.notify();
  }
  patch(runRef: string, partial: Partial<LiveCard>): void {
    const existing = this.cards.get(runRef);
    if (!existing) return;
    this.cards.set(runRef, { ...existing, ...partial });
    this.notify();
  }
  list(): LiveCard[] { return [...this.cards.values()]; }
  isAllSettled(): boolean {
    return [...this.cards.values()].every((c) => c.status !== "running");
  }
  scheduleClear(ms = 8000): void {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      this.cards.clear();
      this.notify();
    }, ms);
    this.clearTimer.unref?.();
  }
  cancelClear(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = undefined;
    }
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  private notify(): void { for (const fn of this.subscribers) fn(); }
}

const liveBus = new LiveProgressBus();

// ============================================================================
// GRID WIDGET (Composite TUI — one Box per running subagent)
// ============================================================================

const GRID_COLUMNS_DEFAULT = 2;
let gridColumns = GRID_COLUMNS_DEFAULT;

class SubagentGridWidget implements Component {
  constructor(private theme: Theme) {}

  render(width: number): string[] {
    const cards = liveBus.list();
    if (cards.length === 0) return [];

    const cols = Math.max(1, Math.min(gridColumns, cards.length));
    // cardWidth must satisfy: cols * cardWidth + (cols-1) * 2 <= width
    const cardWidth = Math.max(24, Math.floor((width - (cols - 1) * 2) / cols));

    const cardLines: string[][] = cards.map((c) => this.renderCard(c, cardWidth));
    const rowHeight = Math.max(...cardLines.map((l) => l.length));

    // Pad each card vertically with blank lines of exact cardWidth
    const blankLine = " ".repeat(cardWidth);
    for (const lines of cardLines) {
      while (lines.length < rowHeight) lines.push(blankLine);
    }

    const out: string[] = [];
    for (let row = 0; row < Math.ceil(cards.length / cols); row++) {
      for (let r = 0; r < rowHeight; r++) {
        const slice: string[] = [];
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          slice.push(idx < cardLines.length ? cardLines[idx][r] : blankLine);
        }
        // Hard guarantee: never exceed width. Truncate joined row if needed.
        const joined = slice.join("  ");
        out.push(this.enforceWidth(joined, width));
      }
      out.push("");
    }
    return out;
  }

  invalidate(): void {}

  // Build a card whose every line is EXACTLY w visible cells.
  // Inner content area is w-2 (subtract the two vertical bars).
  // Inner content has 1-cell padding on each side, so text capacity is w-4.
  private renderCard(c: LiveCard, w: number): string[] {
    const innerWidth = w - 2;       // Between │ ... │
    const textWidth = w - 4;        // Inside the 1-cell side padding
    const elapsed = ((c.status === "running" ? Date.now() - c.startedAt : c.durationMs) / 1000).toFixed(1);
    const statusEmoji = c.status === "done" ? "✓" : c.status === "error" ? "✗" : "⏳";
    const statusColor: keyof Theme["colors"] = c.status === "done" ? "success" : c.status === "error" ? "error" : "warning";

    // Header: left = "emoji @name", right = "Xs · N tools" — both fit in textWidth
    const leftRaw = `${statusEmoji} @${c.agentName}`;
    const rightRaw = `${elapsed}s · ${c.toolCount} tools`;
    const leftFits = truncateToWidth(leftRaw, Math.max(0, textWidth - visibleWidth(rightRaw) - 1));
    const headerInner = this.composeLeftRight(
      this.theme.bold(this.theme.fg(statusColor, leftFits)),
      this.theme.fg("muted", rightRaw),
      visibleWidth(leftFits),
      visibleWidth(rightRaw),
      textWidth
    );
    const taskInner = this.theme.fg("muted", truncateToWidth(c.task || "", textWidth));
    const toolText = c.lastTool ? `» ${c.lastTool}` : "» (initializing)";
    const toolInner = this.theme.fg("accent", truncateToWidth(toolText, textWidth));
    const previewInner = c.lastOutput ? this.theme.fg("dim", truncateToWidth(c.lastOutput, textWidth)) : "";

    const wrapBox = (innerColored: string, innerVisibleWidth: number): string => {
      const padRight = Math.max(0, textWidth - innerVisibleWidth);
      // " " + content + " "*padRight + " "  → exactly innerWidth visible cells
      const padded = ` ${innerColored}${" ".repeat(padRight)} `;
      return this.theme.fg(statusColor, "│") + padded + this.theme.fg(statusColor, "│");
    };

    const top = this.theme.fg(statusColor, "┌" + "─".repeat(innerWidth) + "┐");
    const bot = this.theme.fg(statusColor, "└" + "─".repeat(innerWidth) + "┘");

    return [
      top,
      wrapBox(headerInner, textWidth),
      wrapBox(taskInner, visibleWidth(truncateToWidth(c.task || "", textWidth))),
      wrapBox(toolInner, visibleWidth(truncateToWidth(toolText, textWidth))),
      wrapBox(previewInner, c.lastOutput ? visibleWidth(truncateToWidth(c.lastOutput, textWidth)) : 0),
      bot,
    ];
  }

  private composeLeftRight(leftColored: string, rightColored: string, leftLen: number, rightLen: number, totalWidth: number): string {
    const gap = Math.max(1, totalWidth - leftLen - rightLen);
    return leftColored + " ".repeat(gap) + rightColored;
  }

  // Final safety net: if anything still produces a too-wide line, truncate.
  private enforceWidth(line: string, maxWidth: number): string {
    if (visibleWidth(line) <= maxWidth) return line;
    return truncateToWidth(line, maxWidth);
  }
}

const WIDGET_KEY = "subagents-grid";

function ensureWidget(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => new SubagentGridWidget(theme));
}

// ============================================================================
// SPAWN ENGINE (low-level, exported for reuse by chains.ts)
// ============================================================================

const GENERIC_PROMPT = `You are a focused Pi subagent. Your sole mission is to execute the assigned task and report the result back concisely.

- Do not perform work outside the task.
- Do not request user clarification — you are an isolated process and cannot receive new input.
- If information is missing, assume the most reasonable interpretation and state the assumption explicitly in your output.
- Be direct and dense. Skip pleasantries.`;

function getParentSessionFile(ctx: ExtensionContext): string | null {
  const sm = ctx.sessionManager as unknown as { getSessionFile?: () => string | undefined };
  return sm.getSessionFile?.() ?? null;
}

function buildChildSessionFile(parent: string | null, runId: string, agentName: string): string {
  const baseName = parent ? path.basename(parent, ".jsonl") : "ephemeral";
  const sessionsDir = parent ? path.dirname(parent) : path.join(os.homedir(), ".pi", "agent", "sessions");
  const subDir = path.join(sessionsDir, baseName, runId);
  fs.mkdirSync(subDir, { recursive: true });
  return path.join(subDir, `${agentName}.jsonl`);
}

function extractFinalAssistantText(stdoutLines: string[]): string {
  for (let i = stdoutLines.length - 1; i >= 0; i--) {
    const line = stdoutLines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "message_end" && obj.message?.role === "assistant") {
        const content = obj.message.content;
        if (Array.isArray(content)) {
          const text = content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n")
            .trim();
          if (text) return text;
        }
      }
    } catch { /* skip non-JSON */ }
  }
  return "";
}

// ============================================================================
// EXECUTOR STRATEGY
// Each executor encapsulates how to spawn an external CLI for one chain step.
// pi (default) is feature-complete; claude-cli and opencode-cli sacrifice live
// progress + persistent sessions in exchange for delegating to those tools.
// ============================================================================

interface BuildSpawnInput {
  task: string;
  agent: AgentDef | null;
  thinking?: string;
  sessionFile?: string;       // Only respected by pi executor
  promptPath: string;         // Path to system-prompt file (pi uses --append-system-prompt; claude-cli inlines content)
}

interface BuildSpawnOutput {
  command: string;
  args: string[];
}

interface IExecutor {
  readonly kind: ExecutorKind;
  readonly emitsJsonlEvents: boolean;
  buildSpawn(input: BuildSpawnInput): BuildSpawnOutput;
  parseFinalOutput(stdoutLines: string[]): string;
  parseLiveLine?(line: string): { kind: "tool_start"; toolName: string } | null;
}

class PiExecutor implements IExecutor {
  readonly kind: ExecutorKind = "pi";
  readonly emitsJsonlEvents = true;
  buildSpawn({ task, agent, thinking, sessionFile, promptPath }: BuildSpawnInput): BuildSpawnOutput {
    const args: string[] = ["--mode", "json", "-p"];
    if (sessionFile) args.push("--session", sessionFile);
    if (agent?.provider) args.push("--provider", agent.provider);
    if (agent?.model) args.push("--model", agent.model);
    if (thinking && thinking !== "off") args.push("--thinking", thinking);
    if (agent?.tools) args.push("--tools", agent.tools);
    args.push("--no-skills");
    args.push("--append-system-prompt", promptPath);
    if (agent?.executorArgs) args.push(...splitArgs(agent.executorArgs));
    args.push(`Task: ${task}`);
    return { command: "pi", args };
  }
  parseFinalOutput(lines: string[]): string {
    return extractFinalAssistantText(lines);
  }
  parseLiveLine(line: string) {
    if (!line.trim()) return null;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "tool_execution_start") {
        return { kind: "tool_start" as const, toolName: String(obj.toolName ?? "") };
      }
    } catch { /* not JSON */ }
    return null;
  }
}

class ClaudeCliExecutor implements IExecutor {
  readonly kind: ExecutorKind = "claude-cli";
  readonly emitsJsonlEvents = false;
  buildSpawn({ task, agent, promptPath }: BuildSpawnInput): BuildSpawnOutput {
    // claude takes the prompt as a positional arg. System prompt goes via
    // --append-system-prompt <text>. We read the file we already wrote and
    // pass its content directly (claude expects text, not a path).
    const systemText = fs.readFileSync(promptPath, "utf-8");
    const args: string[] = ["-p", task, "--dangerously-skip-permissions"];
    if (agent?.model) args.push("--model", agent.model);
    args.push("--append-system-prompt", systemText);
    if (agent?.executorArgs) args.push(...splitArgs(agent.executorArgs));
    return { command: "claude", args };
  }
  parseFinalOutput(lines: string[]): string {
    // claude -p emits the assistant response on stdout as plain text.
    return lines.join("\n").trim();
  }
}

class OpencodeCliExecutor implements IExecutor {
  readonly kind: ExecutorKind = "opencode-cli";
  readonly emitsJsonlEvents = false;
  buildSpawn({ task, agent, promptPath }: BuildSpawnInput): BuildSpawnOutput {
    // opencode has no system-prompt flag → prepend the agent's system prompt
    // body into the message itself (separated so the model can distinguish).
    const systemText = fs.readFileSync(promptPath, "utf-8").trim();
    const message = systemText
      ? `# System instructions\n\n${systemText}\n\n# Task\n\n${task}`
      : task;
    const args: string[] = ["run", message];
    if (agent?.model) {
      // opencode expects provider/model — if frontmatter has both, combine; else pass model alone
      const modelArg = agent.provider ? `${agent.provider}/${agent.model}` : agent.model;
      args.push("-m", modelArg);
    }
    if (agent?.executorArgs) args.push(...splitArgs(agent.executorArgs));
    return { command: "opencode", args };
  }
  parseFinalOutput(lines: string[]): string {
    return lines.join("\n").trim();
  }
}

const EXECUTORS: Record<ExecutorKind, IExecutor> = {
  "pi": new PiExecutor(),
  "claude-cli": new ClaudeCliExecutor(),
  "opencode-cli": new OpencodeCliExecutor(),
};

function pickExecutor(agent: AgentDef | null): IExecutor {
  return EXECUTORS[agent?.executor ?? "pi"];
}

// Truncate a stdout line for the live-progress "last tool" slot.
function truncateForProgress(s: string): string {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "").trim();
  return stripped.slice(0, 80);
}

// Tokenize executorArgs preserving quoted strings.
function splitArgs(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

interface SpawnOnceOptions {
  task: string;
  agent?: string;             // Agent name to look up in repository
  cwd?: string;
  thinkingOverride?: string;
  sessionFile?: string;       // If provided, child resumes this session
  runRef: string;
  ctx: ExtensionContext;
  onProgress?: (patch: Partial<LiveCard>) => void;
}

/**
 * Low-level: spawn a single pi child process, capture its final output.
 * Used by spawnSubagents (parallel/sequential) and chains.ts (sequential pipe).
 */
export async function spawnOnce(opts: SpawnOnceOptions): Promise<SubagentResult> {
  const repo = getAgentRepository();
  const agentDef: AgentDef | null = opts.agent ? repo.find(opts.agent) : null;
  const agentName = opts.agent ?? "anon";
  const startedAt = Date.now();
  const executor = pickExecutor(agentDef);
  const thinking = opts.thinkingOverride ?? agentDef?.thinking;

  // Write system prompt to a temp file. pi reads it via --append-system-prompt;
  // claude-cli reads its content and passes it inline; opencode-cli prepends it.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-sub-"));
  const promptPath = path.join(tempDir, `${agentName}.md`);
  fs.writeFileSync(promptPath, agentDef ? agentDef.systemPrompt : GENERIC_PROMPT, { mode: 0o600 });

  // Non-pi executors don't support resumable sessions — warn and ignore the path
  const effectiveSessionFile = executor.kind === "pi" ? opts.sessionFile : undefined;

  const { command, args } = executor.buildSpawn({
    task: opts.task,
    agent: agentDef,
    thinking,
    sessionFile: effectiveSessionFile,
    promptPath,
  });

  const childCwd = opts.cwd ? path.resolve(opts.ctx.cwd, opts.cwd) : opts.ctx.cwd;

  return new Promise<SubagentResult>((resolve) => {
    opts.onProgress?.({ status: "running" });

    const env = {
      ...process.env,
      PI_SUBAGENT_CHILD: "1",
      PI_SUBAGENT_RUN_REF: opts.runRef,
      PI_SUBAGENT_AGENT: agentName,
      PI_SUBAGENT_EXECUTOR: executor.kind,
    };

    let proc: ChildProcess;
    try {
      proc = spawn(command, args, { cwd: childCwd, env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      opts.onProgress?.({ status: "error", durationMs: Date.now() - startedAt });
      resolve({
        agent: agentName,
        task: opts.task,
        output: "",
        exitCode: -1,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
        sessionFile: opts.sessionFile,
        runRef: opts.runRef,
      });
      return;
    }

    const persisted = registry.get(opts.runRef);
    if (persisted) persisted.proc = proc;

    const stdoutLines: string[] = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let toolCount = 0;
    let lastTool: string | undefined;

    proc.stdout?.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      let nl = stdoutBuffer.indexOf("\n");
      while (nl !== -1) {
        const line = stdoutBuffer.slice(0, nl);
        stdoutLines.push(line);
        stdoutBuffer = stdoutBuffer.slice(nl + 1);
        nl = stdoutBuffer.indexOf("\n");
        // Live progress only meaningful when executor emits structured events.
        if (executor.parseLiveLine) {
          const evt = executor.parseLiveLine(line);
          if (evt?.kind === "tool_start") {
            toolCount++;
            lastTool = evt.toolName;
            opts.onProgress?.({ toolCount, lastTool, durationMs: Date.now() - startedAt });
          }
        } else if (line.trim()) {
          // Non-pi executors: surface the latest non-empty line as a coarse progress hint.
          opts.onProgress?.({ lastTool: truncateForProgress(line), durationMs: Date.now() - startedAt });
        }
      }
    });

    proc.stderr?.on("data", (chunk) => { stderrBuffer += chunk.toString(); });

    proc.on("close", (code) => {
      if (stdoutBuffer.length > 0) stdoutLines.push(stdoutBuffer);
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }

      const finalText = executor.parseFinalOutput(stdoutLines);
      const exitCode = code ?? -1;
      const durationMs = Date.now() - startedAt;
      opts.onProgress?.({
        status: exitCode === 0 ? "done" : "error",
        durationMs,
        toolCount,
        lastTool,
        lastOutput: finalText.split("\n")[0] ?? "",
      });

      // Update persisted state
      const p = registry.get(opts.runRef);
      if (p) {
        p.proc = undefined;
        p.status = exitCode === 0 ? "done" : "error";
        p.lastOutput = finalText;
        p.lastDurationMs = durationMs;
      }

      resolve({
        agent: agentName,
        task: opts.task,
        output: finalText || stderrBuffer.trim() || "(no output captured)",
        exitCode,
        durationMs,
        error: exitCode !== 0 ? stderrBuffer.trim() || `exit ${exitCode}` : undefined,
        sessionFile: opts.sessionFile,
        runRef: opts.runRef,
      });
    });

    proc.on("error", (err) => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      opts.onProgress?.({ status: "error", durationMs: Date.now() - startedAt });
      resolve({
        agent: agentName,
        task: opts.task,
        output: "",
        exitCode: -1,
        durationMs: Date.now() - startedAt,
        error: err.message,
        sessionFile: opts.sessionFile,
        runRef: opts.runRef,
      });
    });

    const onAbort = () => {
      try { proc.kill("SIGTERM"); } catch { /* gone */ }
      setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* gone */ } }, 3000).unref();
    };
    opts.ctx.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * High-level: run N tasks (parallel or sequential) with grid UI.
 */
export async function spawnSubagents(input: SpawnInput, ctx: ExtensionContext): Promise<SpawnOutput> {
  const runId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const parentSessionFile = getParentSessionFile(ctx);
  const total = input.tasks.length;

  ensureWidget(ctx);
  liveBus.cancelClear();

  const launch = (task: SubagentTask, index: number): Promise<SubagentResult> => {
    const agentName = task.agent ?? `anon-${index}`;
    const runRef = total > 1 ? `${runId}#${index}` : runId;

    // Reuse existing session if a resumeSessionFile was provided (only for single-task runs)
    const sessionFile = input.resumeSessionFile && total === 1
      ? input.resumeSessionFile
      : buildChildSessionFile(parentSessionFile, runId, agentName);

    // Register persisted state BEFORE spawn so widget + /sublist can see it
    registry.upsert({
      runRef,
      agentName,
      sessionFile,
      cwd: task.cwd ? path.resolve(ctx.cwd, task.cwd) : ctx.cwd,
      createdAt: Date.now(),
      lastTask: task.prompt,
      lastOutput: "",
      lastDurationMs: 0,
      turnCount: input.resumeSessionFile ? (registry.get(runRef)?.turnCount ?? 0) + 1 : 1,
      status: "running",
    });

    liveBus.put({
      runRef,
      agentName,
      task: task.prompt,
      status: "running",
      startedAt: Date.now(),
      durationMs: 0,
      toolCount: 0,
    });

    return spawnOnce({
      task: task.prompt,
      agent: task.agent,
      cwd: task.cwd,
      thinkingOverride: input.thinkingOverride,
      sessionFile,
      runRef,
      ctx,
      onProgress: (patch) => liveBus.patch(runRef, patch),
    });
  };

  let results: SubagentResult[];
  if (input.parallel) {
    results = await Promise.all(input.tasks.map(launch));
  } else {
    results = [];
    for (let i = 0; i < input.tasks.length; i++) {
      results.push(await launch(input.tasks[i], i));
    }
  }

  if (liveBus.isAllSettled()) liveBus.scheduleClear();

  return { results, totalDurationMs: Date.now() - startedAt, runId };
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatResultsAsMarkdown(out: SpawnOutput): string {
  const lines: string[] = [];
  lines.push(`## Subagent results — ${out.results.length} agent(s), ${(out.totalDurationMs / 1000).toFixed(1)}s total · runId: \`${out.runId}\``);
  for (const r of out.results) {
    const status = r.exitCode === 0 ? "✓" : "✗";
    lines.push("");
    lines.push(`### ${status} @${r.agent} · ${(r.durationMs / 1000).toFixed(1)}s${r.runRef ? ` · ref: \`${r.runRef}\`` : ""}`);
    lines.push(`**Task:** ${r.task}`);
    lines.push("");
    lines.push("**Output:**");
    lines.push("");
    lines.push(r.output);
    if (r.error) {
      lines.push("");
      lines.push(`**Error:** ${r.error}`);
    }
  }
  if (out.results.some((r) => r.runRef)) {
    lines.push("");
    lines.push(`> 💡 Continue any subagent's conversation with: \`/subcont <ref> "<new prompt>"\``);
  }
  return lines.join("\n");
}

// ============================================================================
// FLAG PARSER for --sub
// Syntax (tokens after --sub):
//   --sub "<task>"                              → 1 anonymous subagent
//   --sub @name "<task>"                        → 1 with definition
//   --sub @a @b @c "<task>"                     → N agents, same task
//   --sub @a:"task1" @b:"task2"                 → mapped agents → tasks
//   --sub --tasks "t1" "t2" "t3"                → N anonymous, one task each
//   --sub --seq ...                             → sequential (default: parallel)
// ============================================================================

interface ParsedSubFlag {
  spawn: SpawnInput;
  cleanPrompt: string;
}

function parseSubFlag(prompt: string): ParsedSubFlag | null {
  const subIdx = prompt.indexOf("--sub");
  if (subIdx === -1) return null;
  // Don't match --subxxx (only --sub at boundary)
  const after5 = prompt[subIdx + 5];
  if (after5 && /[a-zA-Z0-9_-]/.test(after5)) return null;

  const before = prompt.slice(0, subIdx).trim();
  const after = prompt.slice(subIdx + 5).trim();

  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(after)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }

  let parallel = true;
  const agents: string[] = [];
  const explicitTasks: { agent?: string; prompt: string }[] = [];
  const taskList: string[] = [];
  let mode: "default" | "tasks" = "default";

  for (const t of tokens) {
    if (t === "--seq" || t === "--sequential") { parallel = false; continue; }
    if (t === "--parallel") { parallel = true; continue; }
    if (t === "--tasks") { mode = "tasks"; continue; }

    const mapped = t.match(/^@([\w-]+):(.+)$/);
    if (mapped) { explicitTasks.push({ agent: mapped[1], prompt: mapped[2] }); continue; }
    if (t.startsWith("@")) { agents.push(t.slice(1)); continue; }
    taskList.push(t);
  }

  let tasks: SubagentTask[];
  if (explicitTasks.length > 0) {
    tasks = explicitTasks;
  } else if (agents.length > 0) {
    const sharedTask = taskList.join(" ").trim();
    if (!sharedTask) return null;
    tasks = agents.map((a) => ({ agent: a, prompt: sharedTask }));
  } else if (mode === "tasks" && taskList.length > 0) {
    tasks = taskList.map((p) => ({ prompt: p }));
  } else if (taskList.length > 0) {
    tasks = [{ prompt: taskList.join(" ") }];
  } else {
    return null;
  }

  return { spawn: { tasks, parallel }, cleanPrompt: before };
}

// ============================================================================
// DISPATCH-ONLY MODE
// Strong system-prompt injection for one turn. The LLM is instructed to
// delegate ALL work to spawn_subagent / run_chain, never use direct tools.
// Cannot enforce at API level (setActiveTools is sticky); we trust the prompt.
// ============================================================================

const DISPATCH_ONLY_INSTRUCTION = `# DISPATCH-ONLY MODE ACTIVE FOR THIS TURN

You are operating as a pure orchestrator. You must NOT directly call any of these tools:
- read, write, edit, bash, grep, find, ls

Instead, for EVERY action:
1. Use \`spawn_subagent\` to delegate the work to one or more subagents (parallel when independent).
2. Use \`run_chain\` if a predefined chain matches the task.
3. After receiving subagent results, synthesize them and respond — do NOT do follow-up edits yourself.

If you would normally read a file, instead spawn a subagent that reads it and reports the contents.
If you would normally edit code, spawn a subagent (e.g. @build) to do the edit.
Your only role this turn is: decide → dispatch → summarize.`;

// ============================================================================
// EXTENSION ENTRY POINT
// ============================================================================

export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  // ---- Tool A: LLM-driven trigger ------------------------------------------
  pi.registerTool({
    name: "spawn_subagent",
    label: "Spawn Subagents",
    description:
      "Spawn N child Pi processes (subagents) to delegate independent work in parallel or sequentially. " +
      "Each subagent runs as an isolated 'pi' process with its own session and CANNOT communicate with siblings during execution. " +
      "Use this when the user asks to 'lanza subagentes', 'delega', '@name1 @name2 hagan X', or to inspect/audit several things at once. " +
      "If the user names specific agents (@name), pass them in 'agent' for each task; otherwise leave undefined for a generic subagent. " +
      "Each result includes a 'runRef' that the user can pass to /subcont to resume that subagent's conversation.",
    promptSnippet: "Delegate independent tasks to N child Pi subagents in parallel or sequence",
    promptGuidelines: [
      "Use spawn_subagent only for tasks that are independent — subagents cannot share state during execution.",
      "Use spawn_subagent when the user names @agents explicitly or asks to parallelize independent inspections.",
    ],
    parameters: Type.Object({
      tasks: Type.Array(
        Type.Object({
          agent: Type.Optional(Type.String({ description: "Agent name (looked up across pi/.claude/.gemini/.codex agent dirs); omit for generic subagent" })),
          prompt: Type.String({ description: "Task description" }),
          cwd: Type.Optional(Type.String({ description: "Working directory (defaults to parent cwd)" })),
        }),
        { description: "List of tasks to dispatch, one per subagent" }
      ),
      parallel: Type.Optional(Type.Boolean({ description: "Run concurrently (default true) or sequentially" })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled before start" }], details: {} };
      const out = await spawnSubagents({ tasks: params.tasks, parallel: params.parallel ?? true }, ctx);
      return {
        content: [{ type: "text", text: formatResultsAsMarkdown(out) }],
        details: {
          runId: out.runId,
          totalDurationMs: out.totalDurationMs,
          results: out.results.map((r) => ({
            agent: r.agent,
            runRef: r.runRef,
            exitCode: r.exitCode,
            durationMs: r.durationMs,
            sessionFile: r.sessionFile,
            error: r.error,
          })),
        },
      };
    },
  });

  // ---- Tool B: continue an existing subagent (LLM-driven) ------------------
  pi.registerTool({
    name: "continue_subagent",
    label: "Continue Subagent",
    description:
      "Resume a previously-spawned subagent's conversation by passing a new prompt. The subagent " +
      "remembers its prior context (it loads its own session JSONL). Use the runRef returned by " +
      "spawn_subagent (e.g. 'a8e71d63#0' or 'a8e71d63'). Useful for iterative refinement: " +
      "spawn @reviewer, get feedback, then continue_subagent to ask follow-up questions.",
    promptSnippet: "Resume a previously-spawned subagent by runRef",
    promptGuidelines: [
      "Use continue_subagent when the user asks to follow up with a subagent that already ran (referenced by runRef).",
    ],
    parameters: Type.Object({
      runRef: Type.String({ description: "runRef from a previous spawn_subagent call" }),
      prompt: Type.String({ description: "New prompt for the subagent" }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled before start" }], details: {} };
      const persisted = registry.get(params.runRef);
      if (!persisted) {
        return {
          content: [{ type: "text", text: `runRef "${params.runRef}" not found. Use /sublist to see active subagents.` }],
          details: {},
        };
      }
      const out = await spawnSubagents({
        tasks: [{ agent: persisted.agentName === "anon" ? undefined : persisted.agentName, prompt: params.prompt, cwd: persisted.cwd }],
        parallel: false,
        resumeSessionFile: persisted.sessionFile,
      }, ctx);
      return {
        content: [{ type: "text", text: formatResultsAsMarkdown(out) }],
        details: { runRef: params.runRef, results: out.results },
      };
    },
  });

  // ---- Slash command: /subcont <runRef> <prompt> ---------------------------
  pi.registerCommand("subcont", {
    description: "Continue a subagent's conversation. Usage: /subcont <runRef> <prompt>",
    handler: async (args, ctx) => {
      const trimmed = (args ?? "").trim();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx === -1) {
        ctx.ui.notify("Uso: /subcont <runRef> <prompt>", "warning");
        return;
      }
      const runRef = trimmed.slice(0, spaceIdx);
      const prompt = trimmed.slice(spaceIdx + 1).trim();
      const persisted = registry.get(runRef);
      if (!persisted) {
        ctx.ui.notify(`runRef "${runRef}" no encontrado. Usa /sublist para ver activos.`, "error");
        return;
      }
      const out = await spawnSubagents({
        tasks: [{ agent: persisted.agentName === "anon" ? undefined : persisted.agentName, prompt, cwd: persisted.cwd }],
        parallel: false,
        resumeSessionFile: persisted.sessionFile,
      }, ctx);
      const result = out.results[0];
      ctx.ui.notify(
        `${result.exitCode === 0 ? "✓" : "✗"} @${result.agent} (turn #${persisted.turnCount + 1}, ${(result.durationMs / 1000).toFixed(1)}s)`,
        result.exitCode === 0 ? "success" : "error"
      );
    },
  });

  // ---- Slash command: /sublist ---------------------------------------------
  pi.registerCommand("sublist", {
    description: "List all subagents spawned in this session (with their runRef for /subcont)",
    handler: async (_args, ctx) => {
      const runs = registry.list();
      if (runs.length === 0) {
        ctx.ui.notify("No hay subagentes registrados aún.", "info");
        return;
      }
      const lines = runs.map((r) => {
        const status = r.status === "done" ? "✓" : r.status === "error" ? "✗" : r.status === "running" ? "⏳" : "·";
        return `  ${status} ${r.runRef.padEnd(15)} @${r.agentName.padEnd(15)} turns=${r.turnCount} · ${r.lastTask.slice(0, 50)}`;
      });
      ctx.ui.notify(`Subagents (${runs.length}):\n${lines.join("\n")}`, "info");
    },
  });

  // ---- Slash command: /subkill <runRef> ------------------------------------
  pi.registerCommand("subkill", {
    description: "Kill a running subagent and remove it from the registry. Usage: /subkill <runRef|all>",
    handler: async (args, ctx) => {
      const ref = (args ?? "").trim();
      if (!ref) {
        ctx.ui.notify("Uso: /subkill <runRef> o /subkill all", "warning");
        return;
      }
      if (ref === "all") {
        registry.killAll();
        ctx.ui.notify("Todos los subagents terminados y removidos.", "success");
        return;
      }
      const r = registry.get(ref);
      if (!r) { ctx.ui.notify(`runRef "${ref}" no encontrado.`, "error"); return; }
      try { r.proc?.kill("SIGTERM"); } catch { /* gone */ }
      registry.remove(ref);
      ctx.ui.notify(`@${r.agentName} (${ref}) terminado.`, "success");
    },
  });

  // ---- Slash command: /agents ----------------------------------------------
  pi.registerCommand("agents", {
    description: "List all available agent definitions (pi/.claude/.gemini/.codex)",
    handler: async (_args, ctx) => {
      const repo = getAgentRepository();
      repo.reload(ctx.cwd);
      const grouped = repo.groupedBySource();
      const sources = Object.keys(grouped).sort();
      if (sources.length === 0) {
        ctx.ui.notify("No agents found in any source.", "info");
        return;
      }
      const lines: string[] = [];
      for (const src of sources) {
        lines.push(`\n[${src}]`);
        for (const a of grouped[src]) {
          lines.push(`  @${a.name}${a.description ? ` — ${a.description}` : ""}${a.model ? ` [${a.model}]` : ""}`);
        }
      }
      ctx.ui.notify(`Available agents:${lines.join("\n")}`, "info");
    },
  });

  // ---- Slash command: /subgrid <N> -----------------------------------------
  pi.registerCommand("subgrid", {
    description: "Set the column count for the subagent grid widget (1-4)",
    handler: async (args, ctx) => {
      const n = parseInt((args ?? "").trim(), 10);
      if (!Number.isFinite(n) || n < 1 || n > 4) {
        ctx.ui.notify("Uso: /subgrid <1-4>", "warning");
        return;
      }
      gridColumns = n;
      ctx.ui.notify(`Grid columns = ${n}`, "success");
    },
  });

  // ---- Trigger: --sub flag handler in flags-gateway ------------------------
  import("./flags-gateway.js")
    .then(({ registerFlagHandler }) => {
      registerFlagHandler(pi, {
        match: (prompt: string) => parseSubFlag(prompt),
        priority: 800,
        execute: async (state, ctx, _piApi, parsed: ParsedSubFlag) => {
          state.cleanPrompt = parsed.cleanPrompt;
          const out = await spawnSubagents(
            { ...parsed.spawn, thinkingOverride: state.thinking ?? undefined },
            ctx
          );
          state.systemInjections.push(formatResultsAsMarkdown(out));
        },
      });

      // ---- --dispatch-only flag ----
      registerFlagHandler(pi, {
        match: "--dispatch-only",
        priority: 50,
        execute: (state) => {
          state.systemInjections.push(DISPATCH_ONLY_INSTRUCTION);
        },
      });
    })
    .catch(() => { /* flags-gateway absent; flag triggers silently disabled, tools still work */ });

  // ---- Live widget re-render bridge ----
  pi.on("session_start", async (_event, ctx) => {
    fs.mkdirSync(path.join(os.homedir(), ".pi", "agent", "agents"), { recursive: true });
    getAgentRepository().reload(ctx.cwd);
    ctx.ui.notify("Subagentes activos 🚀  Use --sub | --dispatch-only | /agents | /sublist | /subcont", "info");

    // Subscribe widget to live updates
    if (ctx.hasUI) {
      liveBus.subscribe(() => {
        try { ensureWidget(ctx); } catch { /* ctx may be stale */ }
      });
    }
  });

  pi.on("session_shutdown", async () => {
    registry.killAll();
  });
}
