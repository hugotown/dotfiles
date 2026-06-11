import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { taskRunner } from "../lib/task-runner.ts";

function tmp(files: Record<string, string>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "obra-tr-"));
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(d, f), c);
  return d;
}

describe("taskRunner", () => {
  test("mise task present -> mise run", () => {
    expect(taskRunner(tmp({ "mise.toml": "[tasks.test]\nrun='x'" }), "test")).toBe("mise run test");
  });

  test("mise without the task -> empty (no false command)", () => {
    expect(taskRunner(tmp({ "mise.toml": "[tasks.build]\nrun='x'" }), "test")).toBe("");
  });

  test("just recipe present -> just", () => {
    expect(taskRunner(tmp({ justfile: "test:\n\techo x" }), "test")).toBe("just test");
  });

  test("make target present -> make", () => {
    expect(taskRunner(tmp({ Makefile: "test:\n\techo x" }), "test")).toBe("make test");
  });

  test("nothing -> empty", () => {
    expect(taskRunner(tmp({}), "test")).toBe("");
  });
});
