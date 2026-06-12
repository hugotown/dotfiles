// lib/pi-invocation.ts — Resolve the pi binary and stage the system-prompt temp file.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  const isBunVirtual = script?.startsWith("/$bunfs/root/");
  if (script && !isBunVirtual && fs.existsSync(script)) {
    return { command: process.execPath, args: [script, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  if (/^pi(\.exe)?$/.test(execName)) return { command: process.execPath, args };
  return { command: "pi", args };
}

export async function writeSystemPrompt(name: string, prompt: string): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "daddy-"));
  const safe = name.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(dir, `system-${safe}.md`);
  await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir, filePath };
}

export function cleanupTemp(dir: string | null, filePath: string | null): void {
  if (filePath) try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  if (dir) try { fs.rmdirSync(dir); } catch { /* ignore */ }
}
