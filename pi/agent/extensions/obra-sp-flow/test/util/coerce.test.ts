import { describe, expect, it } from "bun:test";
import { asArray, asString, uniq } from "../../src/util/coerce.ts";

describe("coerce", () => {
	it("asArray returns array or empty", () => {
		expect(asArray([1, 2])).toEqual([1, 2]);
		expect(asArray("nope")).toEqual([]);
	});
	it("asString returns string or empty", () => {
		expect(asString("x")).toBe("x");
		expect(asString(42)).toBe("");
	});
	it("uniq dedupes", () => {
		expect(uniq([1, 1, 2])).toEqual([1, 2]);
	});
});
