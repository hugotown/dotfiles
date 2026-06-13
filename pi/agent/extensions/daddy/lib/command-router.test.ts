// lib/command-router.test.ts
import { test, expect } from "bun:test";
import { parseCommand } from "./command-router.ts";

test("parses flow=name with args", () => {
  expect(parseCommand("flow=fix-issue resolve #42")).toEqual({ kind: "run", flow: "fix-issue", args: "resolve #42" });
});

test("parses approve with comment", () => {
  expect(parseCommand("approve looks good")).toEqual({ kind: "approve", comment: "looks good" });
});

test("parses resume with id", () => {
  expect(parseCommand("resume abc123")).toEqual({ kind: "resume", id: "abc123" });
});

test("parses bare subcommands", () => {
  expect(parseCommand("list").kind).toBe("list");
  expect(parseCommand("merge").kind).toBe("merge");
});

test("unknown subcommand", () => {
  expect(parseCommand("frobnicate").kind).toBe("unknown");
});

test("parses observer command", () => {
  expect(parseCommand("observer")).toEqual({ kind: "observer" });
});
