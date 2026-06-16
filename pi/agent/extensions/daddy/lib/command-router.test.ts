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

test("parses status with optional id", () => {
  expect(parseCommand("status")).toEqual({ kind: "status", id: "" });
  expect(parseCommand("status abc123")).toEqual({ kind: "status", id: "abc123" });
});

test("parses doctor", () => {
  expect(parseCommand("doctor")).toEqual({ kind: "doctor" });
});

test("parses cancel with id and reason", () => {
  expect(parseCommand("cancel r1 because stuck")).toEqual({ kind: "cancel", id: "r1", reason: "because stuck" });
});

test("parses recover", () => {
  expect(parseCommand("recover r1")).toEqual({ kind: "recover", id: "r1" });
});

test("parses retry node", () => {
  expect(parseCommand("retry r1 test-node")).toEqual({ kind: "retry", id: "r1", node: "test-node" });
});

test("parses cleanup", () => {
  expect(parseCommand("cleanup")).toEqual({ kind: "cleanup" });
});

test("parses preflight", () => {
  expect(parseCommand("preflight fix-issue #42")).toEqual({ kind: "preflight", flow: "fix-issue", args: "#42" });
});
