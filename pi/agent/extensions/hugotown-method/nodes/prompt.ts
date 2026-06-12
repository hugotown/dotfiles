// nodes/prompt.ts — Run a prompt/command AI task in an isolated pi subprocess.
import { runPi } from "../lib/runner.ts";
import { substitute } from "../lib/variable-sub.ts";
import { enforceOutput } from "../lib/output-schema.ts";
import { QUESTION_PROHIBITION, DEFAULT_BLOCKED_TOOLS } from "../constants.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export async function runAiTask(rctx: RunCtx, task: string, run = runPi): Promise<NodeResult> {
  const { node, deps, cwd } = rctx;
  const provider = node.provider ?? deps.defaultProvider;
  const model = node.model ?? deps.defaultModel;
  if (!provider || !model) return { status: "failed", output: "", error: "No provider/model resolved for node" };
  const tools = node.allowed_tools?.filter((t) => !DEFAULT_BLOCKED_TOOLS.includes(t));
  const r = await run({
    provider, model, thinking: node.thinking ?? "medium",
    tools, system: QUESTION_PROHIBITION, task, cwd, signal: deps.signal,
    onUpdate: (p) => deps.progress?.(node.id, p),
  });
  if (r.status === "failed") return { status: "failed", output: r.output, error: r.errorMessage ?? r.stderr };
  if (node.output_format) {
    const v = enforceOutput(r.output, node.output_format);
    if (!v.ok) return { status: "failed", output: r.output, error: v.error };
    return { status: "completed", output: r.output, structured: v.data };
  }
  return { status: "completed", output: r.output };
}

export function runPrompt(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  return runAiTask(rctx, substitute(rctx.node.prompt ?? "", rctx.sub), run);
}
