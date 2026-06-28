import { describe, expect, it } from "bun:test";
import { parseJsonLoose } from "../../src/util/json.ts";

describe("parseJsonLoose", () => {
	it("returns null for empty", () => {
		expect(parseJsonLoose("")).toBeNull();
	});
	it("parses direct json", () => {
		expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
	});
	it("strips json fences", () => {
		expect(parseJsonLoose("```json\n{\"a\":2}\n```")).toEqual({ a: 2 });
	});
	it("extracts balanced object with braces inside strings", () => {
		expect(parseJsonLoose('prefix {"a":"}{"} suffix')).toEqual({ a: "}{" });
	});
	it("handles escaped quotes in strings", () => {
		expect(parseJsonLoose('x {"a":"\\""}')).toEqual({ a: '"' });
	});
	it("returns null when no brace present", () => {
		expect(parseJsonLoose("no json here")).toBeNull();
	});
	it("returns null when braces never balance", () => {
		expect(parseJsonLoose("x {oops")).toBeNull();
	});
	it("returns null when balanced slice is invalid json", () => {
		expect(parseJsonLoose("x {bad}")).toBeNull();
	});
});
