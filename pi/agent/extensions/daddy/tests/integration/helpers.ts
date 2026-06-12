// tests/integration/helpers.ts — Shared setup for integration suites.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function defaultModel(): { provider: string; model: string } {
  const settings = path.join(os.homedir(), ".pi", "agent", "settings.json");
  const cfg = JSON.parse(fs.readFileSync(settings, "utf-8"));
  const m: string = cfg.model ?? cfg.defaultModel ?? "";
  if (m.includes("/")) {
    const [provider, ...rest] = m.split("/");
    return { provider, model: rest.join("/") };
  }
  const provider = cfg.defaultProvider ?? (m ? "anthropic" : "anthropic");
  return { provider, model: m || "claude-sonnet-4" };
}

export function tempGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-it-"));
  Bun.spawnSync(["git", "init"], { cwd: dir });
  Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "init"], { cwd: dir });
  return dir;
}

export const realExec = async (command: string, args: string[], options?: { cwd?: string }) => {
  const p = Bun.spawnSync([command, ...args], { cwd: options?.cwd });
  return { stdout: p.stdout.toString(), stderr: p.stderr.toString(), code: p.exitCode, killed: false };
};
