// Typecheck detection and execution.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type RunCmd, type CheckOutcome, tryExec, runResult, fileExists, packageHasScript } from "./check-utils.ts";

export async function runTypecheck(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickTypecheckCmd(pi, cwd, types);
  if (!cmd) return runResult(null, null, "no typecheck command for detected project");
  const r = await tryExec(pi, cwd, cmd);
  return runResult(cmd, r);
}

async function pickTypecheckCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "typecheck")) return { command: "npm", args: ["run", "--silent", "typecheck"] };
    if (await fileExists(pi, cwd, "tsconfig.json")) return { command: "npx", args: ["--no-install", "tsc", "--noEmit"] };
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["check"] };
  if (types.includes("python")) return { command: "mypy", args: ["."] };
  if (types.includes("go")) return { command: "go", args: ["vet", "./..."] };
  if (types.includes("deno")) return { command: "deno", args: ["check", "**/*.ts"] };
  return null;
}
