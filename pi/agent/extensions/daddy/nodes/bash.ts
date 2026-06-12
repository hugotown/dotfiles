// nodes/bash.ts — Run a deterministic bash node. Builtins via env; node outputs inline-quoted.
import { spawn } from "node:child_process";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";

const shQuote = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;

export function inlineOutputs(template: string, sub: SubContext): string {
  const withFields = template.replace(/\$([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)/g, (m, id, f) => {
    const s = sub.nodeStructured[id] as Record<string, unknown> | undefined;
    return s && f in s ? shQuote(String(s[f])) : m;
  });
  return withFields.replace(/\$([A-Za-z0-9_-]+)\.output\b/g, (m, id) =>
    id in sub.nodeOutputs ? shQuote(sub.nodeOutputs[id]) : m);
}

export function runBash(rctx: RunCtx): Promise<NodeResult> {
  const { node, sub, cwd, deps } = rctx;
  const script = inlineOutputs(node.bash ?? "", sub);
  const env = { ...process.env, ...sub.builtins };
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", script], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
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
