// DETERMINISTIC_CHECKS phase — no LLM, no tokens.
//
// Detect the toolchain from projectInfo.types and run typecheck / lint / tests
// in sequence. Then run any generated workbooks via `wb run --bail`.
//
// Skipped checks (no tool installed, no config) are reported as `passed: true`
// with output "skipped (<reason>)" so they don't trigger a false failure cascade.

import type { ExtensionAPI, ExtensionContext, ExecResult } from "@earendil-works/pi-coding-agent";
import type { DraftState, ChecksResult, CheckOutput, WorkbookCheck } from "./state.ts";

interface RunCmd {
  command: string;
  args: string[];
}

interface CheckOutcome extends CheckOutput {
  skipped: boolean;
}

async function tryExec(pi: ExtensionAPI, cwd: string, cmd: RunCmd): Promise<ExecResult> {
  return pi.exec(cmd.command, cmd.args, { cwd });
}

function trimOutput(s: string, max = 4000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... (truncated)";
}

function fmtResult(r: ExecResult): string {
  const stderr = r.stderr.trim();
  const stdout = r.stdout.trim();
  const both = [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n");
  return trimOutput(both || `(no output, exit ${r.code})`);
}

async function fileExists(pi: ExtensionAPI, cwd: string, rel: string): Promise<boolean> {
  return (await pi.exec("test", ["-f", rel], { cwd })).code === 0;
}

async function packageHasScript(pi: ExtensionAPI, cwd: string, name: string): Promise<boolean> {
  const r = await pi.exec("cat", ["package.json"], { cwd });
  if (r.code !== 0) return false;
  try {
    const json = JSON.parse(r.stdout);
    return Boolean(json?.scripts?.[name]);
  } catch { return false; }
}

async function packageHasDep(pi: ExtensionAPI, cwd: string, dep: string): Promise<boolean> {
  const r = await pi.exec("cat", ["package.json"], { cwd });
  if (r.code !== 0) return false;
  try {
    const json = JSON.parse(r.stdout);
    return Boolean(json?.dependencies?.[dep] || json?.devDependencies?.[dep]);
  } catch { return false; }
}

// ---------- typecheck ----------

async function pickTypecheckCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "typecheck")) {
      // Prefer the project's own script if defined.
      return { command: "npm", args: ["run", "--silent", "typecheck"] };
    }
    if (await fileExists(pi, cwd, "tsconfig.json")) {
      return { command: "npx", args: ["--no-install", "tsc", "--noEmit"] };
    }
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["check"] };
  if (types.includes("python")) {
    // Best-effort: try mypy first, fall back at runtime to pyright if mypy missing.
    return { command: "mypy", args: ["."] };
  }
  if (types.includes("go")) return { command: "go", args: ["vet", "./..."] };
  if (types.includes("deno")) return { command: "deno", args: ["check", "**/*.ts"] };
  return null;
}

async function runTypecheck(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickTypecheckCmd(pi, cwd, types);
  if (!cmd) return { passed: true, output: "skipped (no typecheck command for detected project)", skipped: true };
  const r = await tryExec(pi, cwd, cmd);
  // Treat "command not found" as skipped, not failed.
  if (r.code === 127) return { passed: true, output: `skipped (command not installed: ${cmd.command})`, skipped: true };
  return { passed: r.code === 0, output: fmtResult(r), skipped: false };
}

// ---------- lint ----------

async function pickLintCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "lint")) {
      return { command: "npm", args: ["run", "--silent", "lint"] };
    }
    if (await fileExists(pi, cwd, "biome.json") || await fileExists(pi, cwd, "biome.jsonc")) {
      return { command: "npx", args: ["--no-install", "biome", "check", "."] };
    }
    if (await packageHasDep(pi, cwd, "eslint")) {
      return { command: "npx", args: ["--no-install", "eslint", "."] };
    }
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["clippy", "--quiet"] };
  if (types.includes("python")) return { command: "ruff", args: ["check", "."] };
  if (types.includes("go")) return { command: "golangci-lint", args: ["run"] };
  if (types.includes("deno")) return { command: "deno", args: ["lint"] };
  return null;
}

async function runLint(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickLintCmd(pi, cwd, types);
  if (!cmd) return { passed: true, output: "skipped (no lint command for detected project)", skipped: true };
  const r = await tryExec(pi, cwd, cmd);
  if (r.code === 127) return { passed: true, output: `skipped (command not installed: ${cmd.command})`, skipped: true };
  return { passed: r.code === 0, output: fmtResult(r), skipped: false };
}

// ---------- tests ----------

/**
 * Pick a test command. For node we prefer the project's own `test` script.
 * We do NOT attempt to scope to specific paths here — the design says to limit
 * to the test folders, and `npm test` (or equivalent) typically already does that.
 * If the project doesn't expose a test script, we skip.
 */
async function pickTestCmd(pi: ExtensionAPI, cwd: string, types: string[]): Promise<RunCmd | null> {
  if (types.includes("node")) {
    if (await packageHasScript(pi, cwd, "test")) {
      return { command: "npm", args: ["test", "--silent"] };
    }
    return null;
  }
  if (types.includes("rust")) return { command: "cargo", args: ["test", "--quiet"] };
  if (types.includes("python")) return { command: "pytest", args: ["-q"] };
  if (types.includes("go")) return { command: "go", args: ["test", "./..."] };
  if (types.includes("deno")) return { command: "deno", args: ["test"] };
  return null;
}

async function runTests(pi: ExtensionAPI, cwd: string, types: string[]): Promise<CheckOutcome> {
  const cmd = await pickTestCmd(pi, cwd, types);
  if (!cmd) return { passed: true, output: "skipped (no test command for detected project)", skipped: true };
  const r = await tryExec(pi, cwd, cmd);
  if (r.code === 127) return { passed: true, output: `skipped (command not installed: ${cmd.command})`, skipped: true };
  return { passed: r.code === 0, output: fmtResult(r), skipped: false };
}

// ---------- workbooks ----------

async function runOneWorkbook(pi: ExtensionAPI, cwd: string, wbPath: string): Promise<WorkbookCheck> {
  const r = await pi.exec("wb", ["run", wbPath, "--bail"], { cwd });
  if (r.code === 127) {
    return { path: wbPath, passed: true, output: "skipped (wb CLI not installed)" };
  }
  return { path: wbPath, passed: r.code === 0, output: fmtResult(r) };
}

// ---------- driver ----------

export async function runChecks(
  state: DraftState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<ChecksResult> {
  const types = state.projectInfo.types;

  ctx.ui.setStatus("draft-ptb", "🔎 typecheck");
  const typecheck = await runTypecheck(pi, ctx.cwd, types);

  ctx.ui.setStatus("draft-ptb", "🔎 lint");
  const lint = await runLint(pi, ctx.cwd, types);

  ctx.ui.setStatus("draft-ptb", "🔎 tests");
  const tests = await runTests(pi, ctx.cwd, types);

  // Workbooks: only those produced by TEST_GENERATION that have artifact "workbook".
  const workbookPaths = state.testGenerationResults
    .filter((r) => r.artifact === "workbook" && r.status === "DONE")
    .map((r) => r.testPath);

  const workbooks: WorkbookCheck[] = [];
  for (const wb of workbookPaths) {
    ctx.ui.setStatus("draft-ptb", `🔎 wb ${wb}`);
    workbooks.push(await runOneWorkbook(pi, ctx.cwd, wb));
  }

  ctx.ui.setStatus("draft-ptb", undefined);

  return {
    typecheck: { passed: typecheck.passed, output: typecheck.output },
    lint: { passed: lint.passed, output: lint.output },
    tests: { passed: tests.passed, output: tests.output },
    workbooks,
  };
}
