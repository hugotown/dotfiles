import { describe, expect, it } from "bun:test";
import { makeAppendValidator } from "../lib/append-tool.ts";

describe("makeAppendValidator", () => {
	it("accepts a matching node_id with no schema", () => {
		const v = makeAppendValidator("scout", undefined);
		expect(v({ node_id: "scout", status: "ok", output: "x" })).toBeNull();
	});

	it("rejects a mismatched node_id", () => {
		const v = makeAppendValidator("scout", undefined);
		expect(v({ node_id: "other", status: "ok", output: "x" })).toContain("node_id");
	});

	it("rejects when output_schema is declared but structured violates it", () => {
		const v = makeAppendValidator("scout", { type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(v({ node_id: "scout", status: "ok", output: "x", structured: {} })).toContain("ranges");
	});

	it("accepts valid structured against the schema", () => {
		const v = makeAppendValidator("scout", { type: "object", properties: { ranges: { type: "array", items: { type: "string" } } }, required: ["ranges"] });
		expect(v({ node_id: "scout", status: "ok", output: "x", structured: { ranges: ["a"] } })).toBeNull();
	});
});
