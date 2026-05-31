// Test runner detection and execution.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type RunCmd, type CheckOutcome, tryExec, runResult, packageHasScript } from "./check-utils.ts";

export async function runTests(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickTestCmd(pi, cwd, types);
  if (!cmd) return runResult(null, null, "no test command for detected project");
  const r = await tryExec(pi, cwd, cmd);
  return runResult(cmd, r);
}

async function pickTestCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "test")) return { command: "npm", args: ["test", "--silent"] };
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["test", "--quiet"] };
  if (types.includes("python")) return { command: "pytest", args: ["-q"] };
  if (types.includes("go")) return { command: "go", args: ["test", "./..."] };
  if (types.includes("deno")) return { command: "deno", args: ["test"] };
  return null;
}
