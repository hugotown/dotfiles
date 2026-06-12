// lib/command-loader.test.ts
import { test, expect } from "bun:test";
import { loadCommandText } from "./command-loader.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-cmd-"));
fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
fs.writeFileSync(path.join(dir, "commands", "investigate.md"), "Investigate: $ARGUMENTS");

test("loads command text", () => {
  expect(loadCommandText("investigate", [dir])).toContain("Investigate:");
});

test("throws on missing command", () => {
  expect(() => loadCommandText("nope", [dir])).toThrow(/not found/);
});
