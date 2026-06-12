// lib/script-detect.test.ts
import { test, expect } from "bun:test";
import { isInline, runtimeForFile, buildScriptArgv } from "./script-detect.ts";

test("detects inline by metachar/newline", () => {
  expect(isInline("console.log(1)")).toBe(true);
  expect(isInline("my-script")).toBe(false);
  expect(isInline("a\nb")).toBe(true);
});

test("maps extension to runtime", () => {
  expect(runtimeForFile("x.py")).toBe("uv");
  expect(runtimeForFile("x.ts")).toBe("bun");
});

test("builds bun inline argv", () => {
  expect(buildScriptArgv({ inline: "code", runtime: "bun" }, "code"))
    .toEqual(["bun", "--no-env-file", "-e", "code"]);
});

test("builds uv inline argv with deps", () => {
  expect(buildScriptArgv({ inline: "c", runtime: "uv", deps: ["httpx"] }, "c"))
    .toEqual(["uv", "run", "--with", "httpx", "python", "-c", "c"]);
});

test("builds bun named argv", () => {
  expect(buildScriptArgv({ file: "s.ts", runtime: "bun" }, "/abs/s.ts"))
    .toEqual(["bun", "--no-env-file", "run", "/abs/s.ts"]);
});
