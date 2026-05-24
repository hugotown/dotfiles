// Dispatch a SELF-CONTAINED node (bash | flag | llm | ask aiAssisted:false) to its executor.
// AI-ask is NOT handled here — the driver routes it to delegate-ask (design §9).
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runBashNode } from "./run-bash-node.ts";
import { runFlagNode } from "./run-flag-node.ts";
import { runLlmNode } from "./run-llm-node.ts";
import { runAskNode } from "./run-ask-node.ts";
import type { NodeResult, NodeState, StateMachine } from "../types.ts";

export async function runSelfContained(_pi: ExtensionAPI, ctx: ExtensionContext, node: NodeState, state: StateMachine): Promise<NodeResult> {
	switch (node.action) {
		case "bash":
			return runBashNode(node, ctx.cwd);
		case "flag":
			return runFlagNode(node, ctx.cwd);
		case "llm":
			return runLlmNode(node, state, ctx.cwd);
		case "ask":
			return runAskNode(node, ctx); // only reached when aiAssisted:false
		default:
			return { status: "failed", output: `unknown action: ${node.action}` };
	}
}
