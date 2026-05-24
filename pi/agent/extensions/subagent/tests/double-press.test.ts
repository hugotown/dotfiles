import { describe, expect, test } from "bun:test";
import { DoublePressDetector } from "../lib/double-press.ts";

describe("DoublePressDetector", () => {
	test("first press is never a double", () => {
		expect(new DoublePressDetector(300).press(1000)).toBe(false);
	});

	test("second press within the window is a double", () => {
		const d = new DoublePressDetector(300);
		expect(d.press(1000)).toBe(false);
		expect(d.press(1200)).toBe(true);
	});

	test("second press outside the window is not a double", () => {
		const d = new DoublePressDetector(300);
		expect(d.press(1000)).toBe(false);
		expect(d.press(1400)).toBe(false);
	});

	test("three quick presses read as exactly one double", () => {
		const d = new DoublePressDetector(300);
		expect(d.press(1000)).toBe(false);
		expect(d.press(1100)).toBe(true); // completes a double, resets
		expect(d.press(1200)).toBe(false); // third press starts fresh
	});
});
