import { describe, expect, it } from "bun:test";
import { makeRunId, slugify, utcStamp } from "../../src/util/slug.ts";

const fixed = new Date("2026-06-27T13:25:00.123Z");

describe("slug", () => {
	it("slugify normalizes and trims", () => {
		expect(slugify("Add  Feature!")).toBe("add-feature");
	});
	it("slugify falls back to task", () => {
		expect(slugify("!!!")).toBe("task");
	});
	it("utcStamp strips separators and millis", () => {
		expect(utcStamp(fixed)).toBe("20260627T132500Z");
	});
	it("makeRunId joins stamp and slug", () => {
		expect(makeRunId("Do X", fixed)).toBe("20260627T132500Z-do-x");
	});
});
