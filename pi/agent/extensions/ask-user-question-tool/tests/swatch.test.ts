// tests/swatch.test.ts — unit tests for hexToRgb pure logic
import { expect, test } from "bun:test";
import { hexToRgb, swatch } from "../ui/swatch.ts";

test("hexToRgb parses lowercase #rrggbb", () => {
	expect(hexToRgb("#1e88e5")).toEqual([30, 136, 229]);
});

test("hexToRgb parses uppercase without hash", () => {
	expect(hexToRgb("FF0000")).toEqual([255, 0, 0]);
});

test("hexToRgb parses mixed case with hash", () => {
	expect(hexToRgb("#00Ff80")).toEqual([0, 255, 128]);
});

test("hexToRgb returns null for short hex", () => {
	expect(hexToRgb("#fff")).toBeNull();
});

test("hexToRgb returns null for empty string", () => {
	expect(hexToRgb("")).toBeNull();
});

test("hexToRgb returns null for invalid chars", () => {
	expect(hexToRgb("#zzzzzz")).toBeNull();
});

test("hexToRgb handles leading/trailing whitespace", () => {
	expect(hexToRgb("  #212121  ")).toEqual([33, 33, 33]);
});

test("swatch returns 2 spaces for invalid hex", () => {
	expect(swatch("bad")).toBe("  ");
});

test("swatch returns ANSI escape string for valid hex", () => {
	const result = swatch("#ff0000");
	expect(result).toContain("\x1b[48;2;255;0;0m");
	expect(result).toContain("\x1b[0m");
});
