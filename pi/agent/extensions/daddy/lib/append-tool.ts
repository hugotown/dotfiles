// The append_node tool — registered ONLY in the child (DADDY_NODE=1). Validation throws
// to force the model to retry; after MAX_APPEND_ATTEMPTS it fails the node (design §8).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MAX_APPEND_ATTEMPTS, NODE_RESULT_TYPE } from "../constants.ts";
import { AppendNodeParams, type AppendNodeArgs } from "../schema.ts";
import { compileSchema } from "./schema-compile.ts";

/** Pure validator: returns null when the args are acceptable, else an error message. */
export function makeAppendValidator(expectedId: string, outputSchema?: Record<string, unknown>) {
	const check = outputSchema ? compileSchema(outputSchema) : null;
	return (args: AppendNodeArgs): string | null => {
		if (args.node_id !== expectedId) return `node_id must be "${expectedId}", got "${args.node_id}"`;
		if (check) {
			if (args.structured === undefined) return "this node declares output_schema; you must pass `structured`";
			return check(args.structured);
		}
		return null;
	};
}

/** Register the child-only tool. Emits the validated result as a custom message + terminates. */
export function registerAppendTool(pi: ExtensionAPI, expectedId: string, outputSchema?: Record<string, unknown>): void {
	const validate = makeAppendValidator(expectedId, outputSchema);
	let attempts = 0;
	pi.registerTool({
		name: "append_node",
		label: "Append Node Result",
		description: "Commit your final result for this node. Call exactly once when done. Validation forces the required structure.",
		parameters: AppendNodeParams,
		execute: async (_id, params) => {
			const args = params as AppendNodeArgs;
			attempts++;
			const error = validate(args);
			if (error && attempts < MAX_APPEND_ATTEMPTS) throw new Error(error);
			const status = error ? "failed" : args.status;
			const result = { node_id: args.node_id, status, output: args.output, structured: args.structured };
			pi.sendMessage({ customType: NODE_RESULT_TYPE, content: JSON.stringify(result), display: false });
			return { content: [{ type: "text" as const, text: error ? `failed: ${error}` : "committed" }], details: result, terminate: true };
		},
	});
}
