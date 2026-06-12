// nodes/command.ts — Run a command node: load .md template, substitute, run as AI task.
import * as path from "node:path";
import { runAiTask } from "./prompt.ts";
import { loadCommandText } from "../lib/command-loader.ts";
import { substitute } from "../lib/variable-sub.ts";
import { runPi } from "../lib/runner.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export function runCommand(rctx: RunCtx, run = runPi): Promise<NodeResult> {
  const { node, deps } = rctx;
  const dirs = [path.join(deps.projectDir, ".hugotown"), deps.bundledDir];
  const text = loadCommandText(node.command ?? "", dirs);
  return runAiTask(rctx, substitute(text, rctx.sub), run);
}
