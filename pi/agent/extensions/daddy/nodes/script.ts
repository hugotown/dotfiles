// nodes/script.ts — Run a deterministic bun/uv script node (inline or named).
import { spawn } from "node:child_process";
import * as path from "node:path";
import { buildScriptArgv, runtimeForFile } from "../lib/script-detect.ts";
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";
import type { ScriptSpec } from "../types.ts";

export function resolveArgv(spec: ScriptSpec, sub: SubContext, projectDir: string): string[] {
  if (spec.inline !== undefined) return buildScriptArgv(spec, substitute(spec.inline, sub));
  const file = path.join(projectDir, ".daddy", "scripts", spec.file ?? "");
  return buildScriptArgv({ ...spec, runtime: spec.runtime ?? runtimeForFile(file) }, file);
}

export function runScript(rctx: RunCtx): Promise<NodeResult> {
  const { node, sub, cwd, deps } = rctx;
  const argv = resolveArgv(node.script as ScriptSpec, sub, deps.projectDir);
  const env = { ...process.env, ...sub.builtins };
  return new Promise((resolve) => {
    const proc = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("close", (code) => resolve(code === 0
      ? { status: "completed", output: out.replace(/\n$/, "") }
      : { status: "failed", output: out, error: err || `exit ${code}` }));
    proc.on("error", (e) => resolve({ status: "failed", output: "", error: e.message }));
    if (deps.signal) deps.signal.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
