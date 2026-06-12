// nodes/cancel.ts — Cancel the run with a (substituted) reason.
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";

export function runCancel(rctx: RunCtx): NodeResult {
  return { status: "cancelled", output: substitute(rctx.node.cancel ?? "", rctx.sub) };
}
