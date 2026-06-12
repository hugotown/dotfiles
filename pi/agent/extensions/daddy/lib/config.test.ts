// lib/config.test.ts
import { test, expect } from "bun:test";
import { parseConfig, loadConfig } from "./config.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

test("defaults when empty", () => {
  const c = parseConfig("");
  expect(c.concurrency).toBe(4);
  expect(c.nodeTimeoutMs).toBe(600000);
});

test("reads engine overrides", () => {
  const c = parseConfig("engine:\n  concurrency: 8\n  node_timeout_ms: 1000");
  expect(c.concurrency).toBe(8);
  expect(c.nodeTimeoutMs).toBe(1000);
});

test("loadConfig reads from a file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ht-cfg-"));
  const p = path.join(tmp, "config.yml");
  fs.writeFileSync(p, "engine:\n  concurrency: 2\n");
  const c = loadConfig(p);
  expect(c.concurrency).toBe(2);
  expect(c.nodeTimeoutMs).toBe(600000);
});

test("loadConfig returns defaults on missing file", () => {
  const c = loadConfig("/nope/does/not/exist.yml");
  expect(c.concurrency).toBe(4);
});
