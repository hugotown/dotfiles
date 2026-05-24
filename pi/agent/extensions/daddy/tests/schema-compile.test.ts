import { describe, expect, it } from "bun:test";
import { compileSchema } from "../lib/schema-compile.ts";

describe("compileSchema", () => {
	it("accepts a value matching the schema", () => {
		const check = compileSchema({ type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(check({ ranges: ["a:1-2"] })).toBeNull();
	});

	it("returns an error string for a violation", () => {
		const check = compileSchema({ type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(check({})).toContain("ranges");
	});
});
