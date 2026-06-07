// Spawns a child `pi --mode json -p --no-session` process, streams its JSON
// stdout lines, and returns the FINAL assistant text. Used for all three roles:
// planner (no tools), investigator (--tools curl), synthesizer (no tools).
//
// This is the workaround for pi having no in-process LLM API for extensions.
// The pattern mirrors subagent/lib/runner.ts (duplicated by design).
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { RoleSpec, ThinkingLevel } from "../types.ts";

export interface SpawnPiOptions {
  role: RoleSpec;
  thinking: ThinkingLevel;
  tools?: string[]; // undefined → all tools available; [] → no tools; ["curl"] → only curl
  systemPrompt: string;
  userMessage: string;
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface SpawnPiResult {
  finalText: string;
  exitCode: number;
  stderr: string;
  aborted: boolean;
  timedOut: boolean;
}

/** Decide how to invoke pi (current bun runtime vs PATH binary). Mirrors subagent. */
export function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  return isGenericRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

/** Walk parsed JSON-line events and return the last assistant `text` part. */
export function finalAssistantText(jsonLines: string[]): string {
  let last = "";
  for (const line of jsonLines) {
    if (!line.trim()) continue;
    let evt: { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }> } };
    try { evt = JSON.parse(line); } catch { continue; }
    if (evt.type !== "message_end") continue;
    const msg = evt.message;
    if (!msg || msg.role !== "assistant") continue;
    for (const part of msg.content ?? []) {
      if (part.type === "text" && typeof part.text === "string") last = part.text;
    }
  }
  return last;
}

export async function spawnPi(opts: SpawnPiOptions): Promise<SpawnPiResult> {
  // Stage the system prompt as a 0600 temp file (--append-system-prompt-file).
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-investigate-"));
  const promptPath = path.join(dir, "system.md");
  await fs.promises.writeFile(promptPath, opts.systemPrompt, { encoding: "utf-8", mode: 0o600 });

  const baseArgs = [
    "--mode", "json", "-p", "--no-session",
    "--provider", opts.role.provider,
    "--model", opts.role.model,
    "--thinking", opts.thinking,
    "--append-system-prompt", promptPath,
  ];
  if (opts.tools !== undefined) baseArgs.push("--tools", opts.tools.join(","));
  baseArgs.push(opts.userMessage);

  const { command, args } = getPiInvocation(baseArgs);

  return new Promise<SpawnPiResult>((resolve) => {
    const proc = spawn(command, args, { cwd: opts.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    const lines: string[] = [];
    let stderr = "";
    let aborted = false;
    let timedOut = false;
    const cleanup = () => { try { fs.unlinkSync(promptPath); fs.rmdirSync(dir); } catch { /* ignore */ } };

    proc.stdout.on("data", (d: Buffer) => {
      buffer += d.toString("utf-8");
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const p of parts) lines.push(p);
    });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    proc.on("close", (code) => {
      if (buffer.trim()) lines.push(buffer);
      cleanup();
      resolve({ finalText: finalAssistantText(lines), exitCode: code ?? 0, stderr, aborted, timedOut });
    });
    proc.on("error", () => { cleanup(); resolve({ finalText: "", exitCode: 1, stderr, aborted, timedOut }); });

    const kill = (markAs: "aborted" | "timeout") => {
      if (markAs === "aborted") aborted = true;
      else timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 5000);
    };
    if (opts.signal) {
      opts.signal.aborted ? kill("aborted") : opts.signal.addEventListener("abort", () => kill("aborted"), { once: true });
    }
    setTimeout(() => { if (!proc.killed) kill("timeout"); }, opts.timeoutMs);
  });
}
