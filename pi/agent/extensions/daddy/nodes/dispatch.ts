// nodes/dispatch.ts — Route a node to its type handler.
import type { RunCtx, NodeResult } from "../runtime-types.ts";
import type { NodeType, NodeDef } from "../types.ts";
import { runPrompt } from "./prompt.ts";
import { runCommand } from "./command.ts";
import { runBash } from "./bash.ts";
import { runScript } from "./script.ts";
import { runLoop } from "./loop.ts";
import { runApproval } from "./approval.ts";
import { runCancel } from "./cancel.ts";

const ORDER: NodeType[] = ["prompt", "command", "bash", "script", "loop", "approval", "cancel"];

export function nodeType(node: NodeDef): NodeType {
  for (const k of ORDER) if ((node as unknown as Record<string, unknown>)[k] !== undefined) return k;
  throw new Error(`Node "${node.id}" has no type field`);
}

export function dispatchNode(rctx: RunCtx): Promise<NodeResult> | NodeResult {
  switch (nodeType(rctx.node)) {
    case "prompt": return runPrompt(rctx);
    case "command": return runCommand(rctx);
    case "bash": return runBash(rctx);
    case "script": return runScript(rctx);
    case "loop": return runLoop(rctx);
    case "approval": return runApproval(rctx);
    case "cancel": return runCancel(rctx);
  }
}
