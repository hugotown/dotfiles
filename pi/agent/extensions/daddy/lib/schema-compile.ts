// Compile a node's output_schema (a JSON-Schema subset) into a validator.
// TypeBox's Value.Errors validates a plain JSON schema object directly.
import { Value } from "typebox/value";
import type { TSchema } from "typebox";

export type SchemaCheck = (value: unknown) => string | null;

/** Returns a checker: null when valid, else a human-readable first violation. */
export function compileSchema(schema: Record<string, unknown>): SchemaCheck {
	const ts = schema as unknown as TSchema;
	return (value: unknown): string | null => {
		if (Value.Check(ts, value)) return null;
		const first = [...Value.Errors(ts, value)][0];
		return first ? `${first.instancePath || "/"}: ${first.message}` : "schema violation";
	};
}
