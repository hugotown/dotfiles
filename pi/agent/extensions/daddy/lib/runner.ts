// lib/runner.ts — Spawn one isolated `pi --mode json` subprocess; stream NDJSON to a result.
import { spawn } from "node:child_process";
import { getPiInvocation, writeSystemPrompt, cleanupTemp } from "./pi-invocation.ts";
import { applyJsonLine } from "./json-stream.ts";
import type { PiRunResult } from "../runtime-types.ts";

export interface RunPiOpts {
  provider: string; model: string; thinking: string;
  tools?: string[]; system: string; task: string; cwd: string; signal?: AbortSignal;
  onUpdate?: (partial: string) => void;
  onThinking?: (partial: string) => void;
}

interface StreamProcess {
  stdout: { on: (event: "data", cb: (chunk: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (chunk: Buffer | string) => void) => void };
  on: {
    (event: "close", cb: (code: number | null) => void): void;
    (event: "error", cb: () => void): void;
  };
  kill: (signal?: NodeJS.Signals) => unknown;
  killed: boolean;
}

type SpawnLike = (command: string, args: string[], options: { cwd: string; shell: false; stdio: ["ignore", "pipe", "pipe"] }) => StreamProcess;

const spawnProcess: SpawnLike = (command, args, options) => spawn(command, args, options) as unknown as StreamProcess;

export function buildBaseArgs(o: RunPiOpts): string[] {
  const a = ["--mode", "json", "-p", "--no-session", "--provider", o.provider, "--model", o.model, "--thinking", o.thinking];
  if (o.tools && o.tools.length > 0) a.push("--tools", o.tools.join(","));
  return a;
}

export function stream(
  command: string,
  args: string[],
  o: RunPiOpts,
  result: PiRunResult,
  spawnFn: SpawnLike = spawnProcess,
): Promise<{ exitCode: number; aborted: boolean }> {
  return new Promise((resolve) => {
    const proc = spawnFn(command, args, { cwd: o.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "", aborted = false, lastEmit = 0, lastOutput = "", lastThinking = "";
    const emitUpdate = () => {
      if (o.onUpdate && result.output !== lastOutput) {
        lastOutput = result.output;
        o.onUpdate(result.output);
      }
      if (o.onThinking && (result.thinking ?? "") !== lastThinking) {
        lastThinking = result.thinking ?? "";
        o.onThinking(lastThinking);
      }
    };
    proc.stdout.on("data", (d) => {
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let changed = false;
      for (const line of lines) if (applyJsonLine(result, line)) changed = true;
      if (changed && Date.now() - lastEmit > 150) {
        lastEmit = Date.now();
        emitUpdate();
      }
    });
    proc.stderr.on("data", (d) => { result.stderr += d.toString(); });
    proc.on("close", (code) => {
      if (buffer.trim()) applyJsonLine(result, buffer);
      emitUpdate();
      resolve({ exitCode: code ?? 0, aborted });
    });
    proc.on("error", () => resolve({ exitCode: 1, aborted }));
    if (o.signal) {
      const kill = () => { aborted = true; proc.kill("SIGTERM"); setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 5000); };
      o.signal.aborted ? kill() : o.signal.addEventListener("abort", kill, { once: true });
    }
  });
}

export async function runPi(o: RunPiOpts): Promise<PiRunResult> {
  const result: PiRunResult = { output: "", status: "ok", exitCode: 0, stderr: "", messages: [] };
  const sys = await writeSystemPrompt("node", o.system);
  try {
    const args = [...buildBaseArgs(o), "--append-system-prompt", sys.filePath, o.task];
    const { command, args: cmdArgs } = getPiInvocation(args);
    const { exitCode, aborted } = await stream(command, cmdArgs, o, result);
    result.exitCode = exitCode;
    result.status = exitCode === 0 && result.stopReason !== "error" && result.stopReason !== "aborted" && !aborted ? "ok" : "failed";
    return result;
  } finally {
    cleanupTemp(sys.dir, sys.filePath);
  }
}
