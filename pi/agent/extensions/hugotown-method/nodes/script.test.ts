// nodes/script.test.ts
import { test, expect } from "bun:test";
import { resolveArgv, runScript } from "./script.ts";
import type { RunCtx, SubContext } from "../runtime-types.ts";

const sub: SubContext = { builtins: {}, nodeOutputs: { prev: "VALUE" }, nodeStructured: {} };

test("resolveArgv inlines RAW (unquoted) substitution for inline bun", () => {
  const argv = resolveArgv({ inline: "console.log('$prev.output')", runtime: "bun" }, sub, "/p");
  expect(argv).toEqual(["bun", "--no-env-file", "-e", "console.log('VALUE')"]);
});

test("resolveArgv builds named uv path under .hugotown/scripts", () => {
  const argv = resolveArgv({ file: "calc.py" }, sub, "/p");
  expect(argv[0]).toBe("uv");
  expect(argv[argv.length - 1]).toContain("/.hugotown/scripts/calc.py");
});

test("runScript runs inline bun and captures stdout", async () => {
  const ctx: RunCtx = {
    node: { id: "n", script: { inline: "console.log(40 + 2)", runtime: "bun" } },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  expect((await runScript(ctx)).output).toBe("42");
});

test("runScript fails on non-zero exit", async () => {
  const ctx: RunCtx = {
    node: { id: "n", script: { inline: "process.exit(3)", runtime: "bun" } },
    state: {} as RunCtx["state"],
    deps: { exec: (async () => ({ stdout: "", stderr: "", code: 0, killed: false })) as RunCtx["deps"]["exec"], notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" },
    sub, cwd: process.cwd(),
  };
  const r = await runScript(ctx);
  expect(r.status).toBe("failed");
  expect(r.error).toMatch(/exit 3/);
});
