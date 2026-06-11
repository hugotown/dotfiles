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
	label: Type.String({ description: "Short question title shown as the header." }),
	context: Type.String({
		description:
			"REQUIRED. Rich explanation around the question written in the user's language so a non-expert understands it without extra context: WHAT is being asked, WHY it matters / what it affects, HOW it will be used, WHEN/WHERE it applies, and a short flow of what must be decided. Several sentences; do not be terse.",
	}),
	reasoning: Type.String({
		description:
			"REQUIRED. Thorough rationale explaining WHY you recommend the pre-selected default option, including the tradeoffs you weighed.",
	}),
};

/** Discriminated union of every registered type, for the tool's `questions` param. */
export function buildQuestionsSchema(): TSchema {
	return Type.Array(
		Type.Union(allTypes().map((t) => Type.Object({ ...BASE_FIELDS, type: Type.Literal(t.type), ...t.fields }))),
	);
}
