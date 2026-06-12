// lib/artifacts.test.ts
import { test, expect } from "bun:test";
import { createArtifactsDir } from "./artifacts.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

test("creates a per-run artifacts dir", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ht-art-"));
  const dir = createArtifactsDir(home, "run1");
  expect(fs.existsSync(dir)).toBe(true);
  expect(dir).toContain("run1");
});
