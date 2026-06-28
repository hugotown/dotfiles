/** Shared typebox helpers + the contract validator. */
import { type TProperties, type TSchema, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const Base = {
	verdict: Type.Union([Type.Literal("pass"), Type.Literal("block")]),
	blockers: Type.Array(Type.String()),
};

export const S = Type.String();
export const Bool = Type.Boolean();
export const Num = Type.Number();
export const arr = <T extends TSchema>(t: T) => Type.Array(t);
export const opt = <T extends TSchema>(t: T) => Type.Optional(t);

/** Object that tolerates extra props (LLM outputs with surplus fields). */
export function loose<T extends TProperties>(props: T) {
	return Type.Object(props, { additionalProperties: true });
}

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

/** Validate a payload against a contract and return readable errors. */
export function validateContract(schema: TSchema, payload: unknown): ValidationResult {
	if (Value.Check(schema, payload)) return { ok: true, errors: [] };
	const errors = [...Value.Errors(schema, payload)].slice(0, 12).map((e) => `${e.path || "/"}: ${e.message}`);
	return { ok: false, errors };
}
