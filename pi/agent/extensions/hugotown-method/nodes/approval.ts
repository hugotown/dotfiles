// nodes/approval.ts — Signal a non-blocking pause at a human approval gate.
import { substitute } from "../lib/variable-sub.ts";
import type { RunCtx, NodeResult } from "../runtime-types.ts";
import type { ApprovalSpec } from "../types.ts";

export function runApproval(rctx: RunCtx): NodeResult {
  const spec = rctx.node.approval as ApprovalSpec;
  const message = substitute(spec.message, rctx.sub);
  rctx.deps.notify(`Approval required: ${message}`, "info");
  return { status: "paused", output: message };
}
