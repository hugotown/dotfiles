// lib/runner.test.ts
import { test, expect } from "bun:test";
import { buildBaseArgs } from "./runner.ts";

test("assembles fixed flags in order", () => {
  const a = buildBaseArgs({ provider: "anthropic", model: "claude-sonnet-4", thinking: "medium", system: "", task: "t", cwd: "/" });
  expect(a.slice(0, 9)).toEqual(["--mode", "json", "-p", "--no-session", "--provider", "anthropic", "--model", "claude-sonnet-4", "--thinking"]);
});

test("adds --tools allowlist when present", () => {
  const a = buildBaseArgs({ provider: "p", model: "m", thinking: "low", tools: ["read", "edit"], system: "", task: "t", cwd: "/" });
  expect(a).toContain("--tools");
  expect(a[a.indexOf("--tools") + 1]).toBe("read,edit");
});

test("omits --tools when empty", () => {
  const a = buildBaseArgs({ provider: "p", model: "m", thinking: "low", tools: [], system: "", task: "t", cwd: "/" });
  expect(a).not.toContain("--tools");
});
