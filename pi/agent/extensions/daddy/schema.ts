// TypeBox schemas. AppendNodeParams is the child-only tool's parameter contract;
// validation of `structured` against a node's output_schema happens in append-tool.ts.
import { Type } from "typebox";

export const AppendNodeParams = Type.Object({
	node_id: Type.String({
		description: "The id of the node you are producing output for. Must equal the node being executed.",
	}),
	status: Type.Union([Type.Literal("ok"), Type.Literal("failed")], {
		description: "'ok' if you produced the required output, 'failed' if the task cannot be completed.",
	}),
	output: Type.String({
		description: "The produced result as text. Downstream nodes that reference $<this node>.output read exactly this.",
	}),
	structured: Type.Optional(
		Type.Unknown({
			description: "REQUIRED only if this node declared an output_schema. The structured object matching that schema.",
		}),
	),
});

export type AppendNodeArgs = {
	node_id: string;
	status: "ok" | "failed";
	output: string;
	structured?: unknown;
};
