import { describe, expect, it } from "bun:test";
import { compact, shorten, tail } from "../../src/util/text.ts";

describe("text", () => {
	it("shorten collapses whitespace and clips", () => {
		expect(shorten("a   b", 10)).toBe("a b");
		expect(shorten("abcdefg", 3)).toBe("abc…");
	});
	it("tail keeps trailing chars with default", () => {
		expect(tail("short")).toBe("short");
		expect(tail("abcdef", 3)).toBe("…def");
	});
	it("compact collapses and clips with default", () => {
		expect(compact("a  b")).toBe("a b");
		expect(compact("abcdef", 3)).toBe("abc…");
	});
});
