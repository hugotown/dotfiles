// tests/bundled.test.ts
import { test, expect } from "bun:test";
import { parseWorkflow } from "../lib/loader.ts";
import { validateWorkflow } from "../lib/validator.ts";
import * as fs from "node:fs";
import * as path from "node:path";

const wfDir = path.join(import.meta.dir, "..", "workflows");

test("every bundled workflow parses and validates", () => {
  for (const f of fs.readdirSync(wfDir).filter((x) => x.endsWith(".yaml"))) {
    const def = parseWorkflow(fs.readFileSync(path.join(wfDir, f), "utf-8"));
    expect(validateWorkflow(def), `${f} should be valid`).toBeNull();
  }
});

test("referenced commands exist", () => {
  const cmds = fs.readdirSync(path.join(import.meta.dir, "..", "commands")).map((f) => f.replace(/\.md$/, ""));
  for (const f of fs.readdirSync(wfDir).filter((x) => x.endsWith(".yaml"))) {
    const def = parseWorkflow(fs.readFileSync(path.join(wfDir, f), "utf-8"));
    for (const n of def.nodes) if (n.command) expect(cmds, `${n.command} for ${f}`).toContain(n.command);
  }
});
