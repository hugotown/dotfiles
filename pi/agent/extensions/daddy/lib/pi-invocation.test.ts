// lib/pi-invocation.test.ts
import { test, expect } from "bun:test";
import { getPiInvocation, writeSystemPrompt, cleanupTemp } from "./pi-invocation.ts";
import * as fs from "node:fs";

test("getPiInvocation returns a command + args including our args", () => {
  const { command, args } = getPiInvocation(["--mode", "json"]);
  expect(typeof command).toBe("string");
  expect(args).toContain("--mode");
});

test("writeSystemPrompt writes file then cleanup removes it", async () => {
  const { dir, filePath } = await writeSystemPrompt("node", "hello");
  expect(fs.readFileSync(filePath, "utf-8")).toBe("hello");
  cleanupTemp(dir, filePath);
  expect(fs.existsSync(filePath)).toBe(false);
});
