// lib/discovery.test.ts
import { test, expect } from "bun:test";
import { findWorkflow, listWorkflows, findCommand } from "./discovery.ts";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ht-proj-"));
const bundled = fs.mkdtempSync(path.join(os.tmpdir(), "ht-bundled-"));
fs.mkdirSync(path.join(bundled, "workflows"), { recursive: true });
fs.mkdirSync(path.join(proj, "workflows"), { recursive: true });
fs.mkdirSync(path.join(bundled, "commands"), { recursive: true });
fs.writeFileSync(path.join(bundled, "workflows", "fix.yaml"), "name: fix\ndescription: bundled\nnodes:\n  - id: a\n    bash: x");
fs.writeFileSync(path.join(proj, "workflows", "fix.yaml"), "name: fix\ndescription: project\nnodes:\n  - id: a\n    bash: x");
fs.writeFileSync(path.join(bundled, "commands", "c.md"), "hi");

test("project workflow overrides bundled", () => {
  const p = findWorkflow("fix", [proj, bundled]);
  expect(p).toBe(path.join(proj, "workflows", "fix.yaml"));
});

test("listWorkflows dedupes by name (project wins)", () => {
  const list = listWorkflows([proj, bundled]);
  expect(list.find((w) => w.name === "fix")?.description).toBe("project");
});

test("findCommand resolves bundled when not in project", () => {
  expect(findCommand("c", [proj, bundled])).toBe(path.join(bundled, "commands", "c.md"));
});
