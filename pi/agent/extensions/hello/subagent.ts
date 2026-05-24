// Spawns an isolated `pi` subprocess constrained to answer "world" and nothing else.
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** System prompt staged into the child: respond only with "world", do nothing. */
const INSTRUCTION = [
  "You must respond with exactly the single word: world.",
  "Output nothing else — no punctuation, no explanation, no greeting.",
  "Do not use any tools. Do not perform any task. Do not ask questions.",
].join(" ");

/** Decide how to re-spawn pi: the running script under its runtime, or `pi` on PATH. */
function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  return isGenericRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

/** Fold `pi --mode json` stdout: return the latest assistant text seen so far. */
function finalAssistantText(lines: string[]): string {
  let text = "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let event: { type?: string; message?: { role?: string; content?: Array<{ type: string; text?: string }> } };
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "message_end" || event.message?.role !== "assistant") continue;
    for (const part of event.message.content ?? []) {
      if (part.type === "text" && typeof part.text === "string") text = part.text;
    }
  }
  return text;
}

/**
 * Run the isolated subagent for a `--hello` invocation. The user's leftover text
 * becomes the child's prompt; the system prompt forces the "world" answer.
 * Thinking is off so the child neither reasons nor acts — it just replies.
 */
export function runWorldSubagent(prompt: string, cwd: string, timeoutMs = 120_000): Promise<string> {
  const userMessage = prompt.trim() || "hello";
  const piArgs = [
    "--mode", "json",
    "-p",
    "--no-session",
    "--thinking", "off",
    "--append-system-prompt", INSTRUCTION,
    userMessage,
  ];
  const { command, args } = getPiInvocation(piArgs);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    const lines: string[] = [];
    let stderr = "";

    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) lines.push(line);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (buffer.trim()) lines.push(buffer);
      const text = finalAssistantText(lines).trim();
      if (text) return resolve(text);
      reject(new Error(`subagent produced no output (exit ${code}). ${stderr.trim()}`));
    });
  });
}
