// Spawns an isolated child `pi` process (json mode) for autonomous subagents,
// collecting the final assistant text. Adapted from draft-ptb/child-process.ts.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addUsage, emptyUsage, type UsageTotals } from "./metrics.ts";
import { logEvent } from "./observability.ts";

// No child may block the pipeline forever. A stalled child is SIGTERM'd at the
// wall-clock cap, then SIGKILL'd after a short grace, and reported as timedOut so
// the phase escalates instead of hanging (the root cause of the all-night freeze).
const DEFAULT_CHILD_TIMEOUT_MS = 600_000; // 10 min
const SIGKILL_GRACE_MS = 5_000;

export interface SpawnSpec {
  provider: string;
  model: string;
  thinking?: "low" | "medium" | "high";
  systemPrompt: string;
  userTask: string;
  toolAllowlist: string[];
  cwd: string;
  /** Hard wall-clock cap in ms; the child is terminated if exceeded. */
  timeoutMs?: number;
}

export interface SpawnResult {
  exitCode: number;
  finalText: string;
  stderr: string;
  /** Real billed usage summed across the child's assistant turns, or null. */
  usage: UsageTotals | null;
  durationMs: number;
  /** Bytes of the system+task prompt we injected (the optimization target). */
  inputChars: number;
  /** Bytes of the child's final assistant text. */
  outputChars: number;
  /** True when the child was terminated for exceeding its timeout. */
  timedOut: boolean;
}

interface StreamAcc {
  finalText: string;
  usage: UsageTotals;
  sawUsage: boolean;
}

function piInvocation(args: string[]): { command: string; args: string[] } {
  const current = process.argv[1];
  const isBunVirtual = current?.startsWith("/$bunfs/root/");
  if (current && !isBunVirtual && fs.existsSync(current)) {
    return { command: process.execPath, args: [current, ...args] };
  }
  const exec = path.basename(process.execPath).toLowerCase();
  const isRuntime = /^(node|bun)(\.exe)?$/.test(exec);
  return isRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

// Parse one NDJSON line, updating the final assistant text and the running
// usage total. A child may emit several assistant turns (tool use); we keep the
// last text and sum usage across all of them (mirrors pi's footer accounting).
function handleLine(line: string, acc: StreamAcc): void {
  if (!line.trim()) return;
  let ev: { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }>; usage?: unknown } };
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  if (ev.type !== "message_end" || ev.message?.role !== "assistant") return;
  for (const part of ev.message.content ?? []) {
    if (part.type === "text" && typeof part.text === "string") acc.finalText = part.text;
  }
  if (ev.message.usage) {
    acc.usage = addUsage(acc.usage, ev.message.usage);
    acc.sawUsage = true;
  }
}

type CollectResult = Pick<SpawnResult, "exitCode" | "finalText" | "stderr" | "usage" | "timedOut">;

function collect(command: string, args: string[], cwd: string, timeoutMs: number): Promise<CollectResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    const acc: StreamAcc = { finalText: "", usage: emptyUsage(), sawUsage: false };
    const finish = (r: CollectResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve(r);
    };
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already exited */
      }
      killTimer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          /* already exited */
        }
      }, SIGKILL_GRACE_MS);
      finish({
        exitCode: 124,
        finalText: acc.finalText,
        stderr: `${stderr}\n[obra-sp-flow] child exceeded ${timeoutMs}ms and was terminated.`,
        usage: acc.sawUsage ? acc.usage : null,
        timedOut: true,
      });
    }, timeoutMs);
    proc.stdout.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) handleLine(line, acc);
    });
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (buf.trim()) handleLine(buf, acc);
      finish({ exitCode: code ?? 0, finalText: acc.finalText, stderr, usage: acc.sawUsage ? acc.usage : null, timedOut: false });
    });
    proc.on("error", (err) => finish({ exitCode: 1, finalText: acc.finalText, stderr: stderr + String(err), usage: acc.sawUsage ? acc.usage : null, timedOut: false }));
  });
}

export async function runChildPi(spec: SpawnSpec, name: string): Promise<SpawnResult> {
  const startedAt = Date.now();
  const inputChars = spec.systemPrompt.length + spec.userTask.length;
  let dir: string | null = null;
  let file: string | null = null;
  try {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "obra-sp-flow-"));
    file = path.join(dir, `system-${name.replace(/[^\w.-]+/g, "_")}.md`);
    await fs.promises.writeFile(file, spec.systemPrompt, { encoding: "utf-8", mode: 0o600 });
    const args = [
      // --no-skills: the child must follow ONLY the distilled core we inject via
      // --append-system-prompt. Without it, pi auto-lists every SKILL.md (incl. the
      // raw writing-plans, with its "REQUIRED SUB-SKILL" header + Execution Handoff),
      // which competes with — and overrides — our core. Also saves tokens.
      "--mode", "json", "-p", "--no-session", "--no-skills",
      "--provider", spec.provider, "--model", spec.model,
      "--thinking", spec.thinking ?? "medium",
      "--tools", spec.toolAllowlist.join(","),
      "--append-system-prompt", file,
      spec.userTask,
    ];
    const { command, args: cmdArgs } = piInvocation(args);
    const res = await collect(command, cmdArgs, spec.cwd, spec.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS);
    const durationMs = Date.now() - startedAt;
    logEvent({ event: "spawn", tag: name, model: `${spec.provider}/${spec.model}`, exitCode: res.exitCode, timedOut: res.timedOut, durationMs });
    return { ...res, durationMs, inputChars, outputChars: res.finalText.length };
  } catch (err) {
    // Setup/spawn failure must surface as a failed child, never a thrown exception
    // that could break the orchestrator loop.
    logEvent({ event: "spawn_error", tag: name, model: `${spec.provider}/${spec.model}`, error: String(err).slice(0, 200) });
    return {
      exitCode: 1,
      finalText: "",
      stderr: `[obra-sp-flow] runChildPi failed: ${String(err)}`,
      usage: null,
      durationMs: Date.now() - startedAt,
      inputChars,
      outputChars: 0,
      timedOut: false,
    };
  } finally {
    if (file) {
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    }
    if (dir) {
      try { fs.rmdirSync(dir); } catch { /* ignore */ }
    }
  }
}
