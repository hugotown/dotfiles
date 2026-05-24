// registry.ts — question-type registry + discriminated-union schema builder (Open/Closed)
import { Type, type TSchema } from "typebox";
import type { AnswerType } from "./types.ts";

const types = new Map<string, AnswerType>();

export function registerType(t: AnswerType): void {
	types.set(t.type, t);
}
export function getType(type: string): AnswerType | undefined {
	return types.get(type);
}
export function allTypes(): AnswerType[] {
	return [...types.values()];
}

const BASE_FIELDS = {
	id: Type.String(),
	label: Type.String(),
	reasoning: Type.Optional(Type.String()),
};

/** Discriminated union of every registered type, for the tool's `questions` param. */
export function buildQuestionsSchema(): TSchema {
	return Type.Array(
		Type.Union(allTypes().map((t) => Type.Object({ ...BASE_FIELDS, type: Type.Literal(t.type), ...t.fields }))),
	);
}
