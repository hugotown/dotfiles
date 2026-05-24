// llm node: spawn an isolated child pi (DADDY_NODE=1) that registers ONLY append_node.
// The resolved prompt is the child's user message (positional, mirrors hello/subagent);
// instructions become its system prompt. The expected node id + output_schema are passed
// via env so the child's append_node tool can validate (design §10, Task 23 child contract).
import { DADDY_NODE_ENV, DADDY_NODE_ID_ENV, DADDY_NODE_SCHEMA_ENV, NODE_RESULT_TYPE } from "../constants.ts";
import { lastCustomMessage } from "./json-stream.ts";
import { resolveRefs } from "./resolve-refs.ts";
import { spawnPi } from "./spawn-pi.ts";
import type { NodeResult, NodeState, StateMachine } from "../types.ts";

export async function runLlmNode(node: NodeState, state: StateMachine, cwd: string): Promise<NodeResult> {
	const prompt = resolveRefs(node.prompt ?? "", state, state.arguments);
	const instructions = `${node.instructions ?? ""}\nWhen finished, call append_node exactly once with node_id="${node.id}".`;
	const args = ["--mode", "json", "-p", "--no-session", "--thinking", node.variant ?? "medium", "--append-system-prompt", instructions, prompt];
	const env = {
		[DADDY_NODE_ENV]: "1",
		[DADDY_NODE_ID_ENV]: node.id,
		[DADDY_NODE_SCHEMA_ENV]: node.output_schema ? JSON.stringify(node.output_schema) : "",
	};
	const { lines, stderr, code } = await spawnPi(args, cwd, { env });
	const raw = lastCustomMessage(lines, NODE_RESULT_TYPE);
	if (!raw) return { status: "failed", output: stderr.trim() || `llm node produced no append_node result (exit ${code})` };
	const parsed = JSON.parse(raw) as { status: "ok" | "failed"; output: string; structured?: unknown };
	return { status: parsed.status, output: parsed.output, structured: parsed.structured };
}
