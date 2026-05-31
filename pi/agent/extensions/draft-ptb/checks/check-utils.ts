// Shared utilities for deterministic checks.

import type { ExtensionAPI, ExecResult } from "@earendil-works/pi-coding-agent";
import type { CheckOutput } from "../state.ts";
import { fileExists, packageHasScript, packageHasDep } from "../utils.ts";

export { fileExists, packageHasScript, packageHasDep };

export interface RunCmd { command: string; args: string[] }
export interface CheckOutcome extends CheckOutput { skipped: boolean }

export async function tryExec(pi: ExtensionAPI, cwd: string, cmd: RunCmd): Promise<ExecResult> {
  return pi.exec(cmd.command, cmd.args, { cwd });
}

export function fmtResult(r: ExecResult): string {
  const stderr = r.stderr.trim();
  const stdout = r.stdout.trim();
  const both = [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n");
  return trimOutput(both || `(no output, exit ${r.code})`);
}

function trimOutput(s: string, max = 4000): string {
  return s.length <= max ? s : s.slice(0, max) + "\n... (truncated)";
}

export function runResult(cmd: RunCmd | null, r: ExecResult | null, skipReason?: string): CheckOutcome {
  if (!cmd || !r) return { passed: true, output: `skipped (${skipReason ?? "no command"})`, skipped: true };
  if (r.code === 127) return { passed: true, output: `skipped (command not installed: ${cmd.command})`, skipped: true };
  return { passed: r.code === 0, output: fmtResult(r), skipped: false };
}
