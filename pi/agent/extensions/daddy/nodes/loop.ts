// nodes/loop.ts — Run an AI loop until a completion signal, until_bash, or max iterations.
import { runPi } from "../lib/runner.ts";
import { substitute } from "../lib/variable-sub.ts";
import { detectSignal, stripSignalTags } from "../lib/completion.ts";
import { QUESTION_PROHIBITION } from "../constants.ts";
import type { RunCtx, NodeResult, SubContext } from "../runtime-types.ts";
import type { LoopSpec } from "../types.ts";

async function untilBashPasses(script: string, sub: SubContext, rctx: RunCtx): Promise<boolean> {
  const r = await rctx.deps.exec("bash", ["-c", substitute(script, sub)], { cwd: rctx.cwd, signal: rctx.deps.signal });
  return r.code === 0;
}

export async function runLoop(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  const { node, deps, sub, cwd } = rctx;
  const spec = node.loop as LoopSpec;
  const provider = node.provider ?? deps.defaultProvider;
  const model = node.model ?? deps.defaultModel;
  if (!provider || !model) return { status: "failed", output: "", error: "No provider/model resolved" };
  let prev = "";
  for (let i = 0; i < spec.max_iterations; i++) {
    const iterSub: SubContext = { ...sub, builtins: { ...sub.builtins, LOOP_PREV_OUTPUT: prev } };
    const r = await run({
      provider, model, thinking: node.thinking ?? "medium", tools: node.allowed_tools,
      system: QUESTION_PROHIBITION, task: substitute(spec.prompt, iterSub), cwd, signal: deps.signal,
      onUpdate: (p) => deps.progress?.(`${node.id} #${i + 1}`, p),
    });
    if (r.status === "failed") return { status: "failed", output: r.output, error: r.errorMessage ?? r.stderr };
    prev = stripSignalTags(r.output);
    if (detectSignal(r.output, spec.until)) return { status: "completed", output: prev };
    if (spec.until_bash && (await untilBashPasses(spec.until_bash, iterSub, rctx))) {
      return { status: "completed", output: prev };
    }
  }
  return { status: "failed", output: prev, error: `Loop exceeded ${spec.max_iterations} iterations` };
}
