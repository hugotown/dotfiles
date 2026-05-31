// Lint detection and execution.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type RunCmd, type CheckOutcome, tryExec, runResult, fileExists, packageHasScript, packageHasDep } from "./check-utils.ts";

export async function runLint(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickLintCmd(pi, cwd, types);
  if (!cmd) return runResult(null, null, "no lint command for detected project");
  const r = await tryExec(pi, cwd, cmd);
  return runResult(cmd, r);
}

async function pickLintCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "lint")) return { command: "npm", args: ["run", "--silent", "lint"] };
    if (await fileExists(pi, cwd, "biome.json") || await fileExists(pi, cwd, "biome.jsonc")) {
      return { command: "npx", args: ["--no-install", "biome", "check", "."] };
    }
    if (await packageHasDep(pi, cwd, "eslint")) return { command: "npx", args: ["--no-install", "eslint", "."] };
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["clippy", "--quiet"] };
  if (types.includes("python")) return { command: "ruff", args: ["check", "."] };
  if (types.includes("go")) return { command: "golangci-lint", args: ["run"] };
  if (types.includes("deno")) return { command: "deno", args: ["lint"] };
  return null;
}
