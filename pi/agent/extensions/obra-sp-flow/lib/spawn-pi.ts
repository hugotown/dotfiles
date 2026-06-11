// Spawns an isolated child `pi` process (json mode) for autonomous subagents,
// collecting the final assistant text. Adapted from draft-ptb/child-process.ts.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addUsage, emptyUsage, type UsageTotals } from "./metrics.ts";

export interface SpawnSpec {
  provider: string;
  model: string;
  thinking?: "low" | "medium" | "high";
  systemPrompt: string;
  userTask: string;
  toolAllowlist: string[];
  cwd: string;
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

type CollectResult = Pick<SpawnResult, "exitCode" | "finalText" | "stderr" | "usage">;

function collect(command: string, args: string[], cwd: string): Promise<CollectResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    const acc: StreamAcc = { finalText: "", usage: emptyUsage(), sawUsage: false };
    proc.stdout.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) handleLine(line, acc);
    });
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (buf.trim()) handleLine(buf, acc);
      resolve({ exitCode: code ?? 0, finalText: acc.finalText, stderr, usage: acc.sawUsage ? acc.usage : null });
    });
    proc.on("error", (err) => resolve({ exitCode: 1, finalText: acc.finalText, stderr: stderr + String(err), usage: acc.sawUsage ? acc.usage : null }));
  });
}

export async function runChildPi(spec: SpawnSpec, name: string): Promise<SpawnResult> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "obra-sp-flow-"));
  const file = path.join(dir, `system-${name.replace(/[^\w.-]+/g, "_")}.md`);
  await fs.promises.writeFile(file, spec.systemPrompt, { encoding: "utf-8", mode: 0o600 });
  const inputChars = spec.systemPrompt.length + spec.userTask.length;
  const startedAt = Date.now();
  try {
    const args = [
      "--mode", "json", "-p", "--no-session",
      "--provider", spec.provider, "--model", spec.model,
      "--thinking", spec.thinking ?? "medium",
      "--tools", spec.toolAllowlist.join(","),
      "--append-system-prompt", file,
      spec.userTask,
    ];
    const { command, args: cmdArgs } = piInvocation(args);
    const res = await collect(command, cmdArgs, spec.cwd);
    return { ...res, durationMs: Date.now() - startedAt, inputChars, outputChars: res.finalText.length };
  } finally {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
    try { fs.rmdirSync(dir); } catch { /* ignore */ }
  }
}
