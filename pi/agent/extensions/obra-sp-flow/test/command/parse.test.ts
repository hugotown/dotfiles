import { describe, expect, it } from "bun:test";
import { parseObraCommand } from "../../src/command/parse.ts";

describe("parseObraCommand", () => {
	it("parses help forms", () => {
		expect(parseObraCommand(" ")).toEqual({ kind: "help" });
		expect(parseObraCommand("--help")).toEqual({ kind: "help" });
		expect(parseObraCommand("-h")).toEqual({ kind: "help" });
	});

	it("parses init", () => {
		expect(parseObraCommand("--init")).toEqual({ kind: "init" });
	});

	it("parses continue with and without selector", () => {
		expect(parseObraCommand("--continue")).toEqual({ kind: "continue" });
		expect(parseObraCommand("--continue abc")).toEqual({ kind: "continue", selector: "abc" });
	});

	it("parses a new requirement", () => {
		expect(parseObraCommand("crear spec")).toEqual({ kind: "start", requirement: "crear spec" });
		expect(parseObraCommand("--continue-work")).toEqual({ kind: "start", requirement: "--continue-work" });
	});
});
