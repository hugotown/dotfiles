import { describe, expect, test } from "bun:test";
import { describeGraphError, validateGraph } from "../lib/validate.ts";
import { spec } from "./fixtures.ts";

describe("validateGraph", () => {
	test("accepts a valid graph", () => {
		expect(validateGraph([spec("a"), spec("b", ["a"])])).toBeNull();
	});

	test("rejects duplicate names", () => {
		expect(validateGraph([spec("a"), spec("a")])).toEqual({ kind: "duplicate", name: "a" });
	});

	test("rejects self dependency", () => {
		expect(validateGraph([spec("a", ["a"])])).toEqual({ kind: "self-dependency", name: "a" });
	});

	test("rejects unknown dependency", () => {
		expect(validateGraph([spec("a", ["ghost"])])).toEqual({
			kind: "unknown-dependency",
			agent: "a",
			dependency: "ghost",
		});
	});

	test("detects a cycle", () => {
		const err = validateGraph([spec("a", ["b"]), spec("b", ["a"])]);
		expect(err?.kind).toBe("cycle");
		expect(describeGraphError(err!)).toContain("cycle");
	});
});
