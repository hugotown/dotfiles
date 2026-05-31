// Shared child `pi` process spawning utilities.
// Eliminates duplication between parallel-dispatcher and review-dispatcher.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface SpawnSpec {
  provider: string;
  model: string;
  systemPrompt: string;
  userTask: string;
  toolAllowlist: string[];
  cwd: string;
  thinking?: "low" | "medium" | "high";
}

export interface SpawnResult {
  exitCode: number;
  finalText: string;
  stderr: string;
}

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

export async function writeSystemPromptFile(name: string, prompt: string): Promise<{ dir: string; file: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "draft-ptb-sub-"));
  const safe = name.replace(/[^\w.-]+/g, "_");
  const file = path.join(dir, `system-${safe}.md`);
  await fs.promises.writeFile(file, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir, file };
}

export function cleanup(dir: string | null, file: string | null): void {
  if (file) { try { fs.unlinkSync(file); } catch { /* ignore */ } }
  if (dir) { try { fs.rmdirSync(dir); } catch { /* ignore */ } }
}

export async function runChildPi(spec: SpawnSpec, taskName: string): Promise<SpawnResult> {
  const { dir, file } = await writeSystemPromptFile(taskName, spec.systemPrompt);
  try {
    const args = [
      "--mode", "json", "-p", "--no-session",
      "--provider", spec.provider, "--model", spec.model,
      "--thinking", spec.thinking ?? "medium",
      "--tools", spec.toolAllowlist.join(","),
      "--append-system-prompt", file,
      spec.userTask,
    ];
    const { command, args: cmdArgs } = getPiInvocation(args);
    return await spawnAndCollect(command, cmdArgs, spec.cwd);
  } finally {
    cleanup(dir, file);
  }
}

function spawnAndCollect(command: string, args: string[], cwd: string): Promise<SpawnResult> {
  return new Promise<SpawnResult>((resolve) => {
    const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    let finalText = "";
    proc.stdout.on("data", (data) => {
      buf += data.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) finalText = extractFinalText(line, finalText);
    });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      if (buf.trim()) finalText = extractFinalText(buf, finalText);
      resolve({ exitCode: code ?? 0, finalText, stderr });
    });
    proc.on("error", (err) => resolve({ exitCode: 1, finalText, stderr: stderr + String(err) }));
  });
}

function extractFinalText(line: string, current: string): string {
  if (!line.trim()) return current;
  let event: { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }> } };
  try { event = JSON.parse(line); } catch { return current; }
  if (event.type !== "message_end" || event.message?.role !== "assistant") return current;
  for (const part of event.message.content ?? []) {
    if (part.type === "text" && typeof part.text === "string") return part.text;
  }
  return current;
}
