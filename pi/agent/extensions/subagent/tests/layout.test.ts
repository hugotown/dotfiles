import { describe, expect, test } from "bun:test";
import { joinColumns } from "../panel/layout.ts";

describe("joinColumns", () => {
	test("zips rows with the gap", () => {
		const rows = joinColumns(["aa", "bb"], ["1", "2"], 2, 2, " | ");
		expect(rows).toEqual(["aa | 1", "bb | 2"]);
	});

	test("pads missing left rows to leftWidth and tolerates missing right rows", () => {
		const rows = joinColumns(["aa"], ["1", "2"], 2, 2, " | ");
		expect(rows[0]).toBe("aa | 1");
		expect(rows[1]).toBe("   | 2"); // left padded to width 2 + gap
	});
});
