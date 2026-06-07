import { describe, expect, test } from "bun:test";
import { wordWrap } from "../panel/palette.ts";

describe("wordWrap", () => {
	test("returns the single line when it fits", () => {
		expect(wordWrap("hello", 10)).toEqual(["hello"]);
	});

	test("splits a long line on word boundaries", () => {
		expect(wordWrap("the quick brown fox jumps", 10)).toEqual(["the quick", "brown fox", "jumps"]);
	});

	test("breaks a single word longer than width at character boundaries", () => {
		expect(wordWrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
	});

	test("preserves explicit newlines as hard breaks", () => {
		expect(wordWrap("first line\nsecond line", 30)).toEqual(["first line", "second line"]);
	});

	test("collapses multiple spaces to single spaces when wrapping", () => {
		expect(wordWrap("a  b  c", 3)).toEqual(["a b", "c"]);
	});

	test("empty string returns empty array", () => {
		expect(wordWrap("", 10)).toEqual([]);
	});
});
