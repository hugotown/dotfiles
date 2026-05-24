// tests/registry.test.ts — registry unit tests
import { expect, test, beforeEach } from "bun:test";
import { registerType, getType, allTypes, buildQuestionsSchema } from "../registry.ts";
import type { AnswerType, BaseQuestion } from "../types.ts";
import { Type } from "typebox";

// Fake type used across tests
const fakeType: AnswerType = {
	type: "fake_color",
	fields: { hex: Type.Optional(Type.String()) },
	initial: () => "",
	display: (_q, a) => String(a),
	open: (_c, _q, _cur, done) => ({ render: () => [], handleInput: () => done("") }),
	toText: (_q, a) => String(a),
};

// Re-registering is idempotent — Map.set overwrites
beforeEach(() => { registerType(fakeType); });

test("getType returns registered type", () => {
	expect(getType("fake_color")).toBe(fakeType);
});

test("getType returns undefined for unknown", () => {
	expect(getType("does_not_exist")).toBeUndefined();
});

test("allTypes includes registered type", () => {
	const found = allTypes().find((t) => t.type === "fake_color");
	expect(found).toBeDefined();
});

test("buildQuestionsSchema produces a Type.Array union that includes fake_color", () => {
	const schema = buildQuestionsSchema() as { type: string; items: { anyOf: { properties: { type: { const: string } } }[] } };
	expect(schema.type).toBe("array");
	const union = schema.items.anyOf;
	const hasFake = union.some((branch) => branch.properties.type.const === "fake_color");
	expect(hasFake).toBe(true);
});

test("BaseQuestion type field from schema matches registered literal", () => {
	const schema = buildQuestionsSchema() as { items: { anyOf: { properties: { type: { const: string } } }[] } };
	const branch = schema.items.anyOf.find((b) => b.properties.type.const === "fake_color");
	expect(branch).toBeDefined();
	expect(branch?.properties.type.const).toBe("fake_color");
});
