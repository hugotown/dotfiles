// lib/runner.test.ts
import { test, expect } from "bun:test";
import { EventEmitter } from "node:events";
import { buildBaseArgs, stream } from "./runner.ts";
import type { PiRunResult } from "../runtime-types.ts";

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

test("stream emits the final buffered output without a trailing newline", async () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; killed: boolean; kill: () => void };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.killed = false;
  proc.kill = () => {};
  const updates: string[] = [];
  const spawn = () => proc;
  const result: PiRunResult = { output: "", status: "ok", exitCode: 0, stderr: "", messages: [] };
  const done = stream("pi", [], { provider: "p", model: "m", thinking: "low", system: "", task: "t", cwd: "/", onUpdate: (text) => updates.push(text) }, result, spawn as never);

  stdout.emit("data", JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Final" } }));
  proc.emit("close", 0);
  await done;

  expect(updates).toEqual(["Final"]);
});
