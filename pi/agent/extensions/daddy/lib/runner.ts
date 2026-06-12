// lib/runner.ts — Spawn one isolated `pi --mode json` subprocess; stream NDJSON to a result.
import { spawn } from "node:child_process";
import { getPiInvocation, writeSystemPrompt, cleanupTemp } from "./pi-invocation.ts";
import { applyJsonLine } from "./json-stream.ts";
import type { PiRunResult } from "../runtime-types.ts";

export interface RunPiOpts {
  provider: string; model: string; thinking: string;
  tools?: string[]; system: string; task: string; cwd: string; signal?: AbortSignal;
  onUpdate?: (partial: string) => void;
}

export function buildBaseArgs(o: RunPiOpts): string[] {
  const a = ["--mode", "json", "-p", "--no-session", "--provider", o.provider, "--model", o.model, "--thinking", o.thinking];
  if (o.tools && o.tools.length > 0) a.push("--tools", o.tools.join(","));
  return a;
}

function stream(command: string, args: string[], o: RunPiOpts, result: PiRunResult): Promise<{ exitCode: number; aborted: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd: o.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "", aborted = false, lastEmit = 0;
    proc.stdout.on("data", (d) => {
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let changed = false;
      for (const line of lines) if (applyJsonLine(result, line)) changed = true;
      if (changed && o.onUpdate && Date.now() - lastEmit > 150) {
        lastEmit = Date.now();
        o.onUpdate(result.output);
      }
    });
    proc.stderr.on("data", (d) => { result.stderr += d.toString(); });
    proc.on("close", (code) => { if (buffer.trim()) applyJsonLine(result, buffer); resolve({ exitCode: code ?? 0, aborted }); });
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
