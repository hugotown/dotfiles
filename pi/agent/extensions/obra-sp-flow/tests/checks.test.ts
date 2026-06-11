import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runChecks } from "../lib/checks.ts";
import type { ResolvedChecks } from "../lib/resolve-checks.ts";
import type { Config } from "../types.ts";

function cfg(): Config {
  return {
    phases: {} as any,
    limits: { implConcurrency: 4, debugSubcyclesPerError: 5, debugGlobalCap: 15, questionArchitectureThreshold: 3, coverageThreshold: 90, childTimeoutMs: 600_000 },
    branch: { prefix: "feature", base: "main" },
    finish: { action: "pr" },
    checks: { build: "", typecheck: "", test: "", lint: "", format: "" },
    skillsDir: "~",
  } as Config;
}

function resolved(over: Partial<ResolvedChecks>): ResolvedChecks {
  return { build: "", typecheck: "", test: "", lint: "", format: "", ...over };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "obra-chk-"));

describe("runChecks", () => {
  test("passing test command -> passed", () => {
    expect(runChecks(tmp(), cfg(), resolved({ test: "true" })).passed).toBe(true);
  });

  test("failing test command -> not passed", () => {
    expect(runChecks(tmp(), cfg(), resolved({ test: "false" })).passed).toBe(false);
  });

  test("missing test binary -> failure (cannot verify)", () => {
    const r = runChecks(tmp(), cfg(), resolved({ test: "nonexistent-bin-xyz" }));
    expect(r.passed).toBe(false);
    expect(r.failures.join()).toContain("missing");
  });

  test("missing optional typecheck binary -> skipped, not a failure", () => {
    const r = runChecks(tmp(), cfg(), resolved({ typecheck: "nonexistent-bin-xyz", test: "true" }));
    expect(r.passed).toBe(true);
    expect(r.results.find((x) => x.name === "typecheck")?.skipped).toBe(true);
  });

  test("no test runner at all -> failure", () => {
    const r = runChecks(tmp(), cfg(), resolved({}));
    expect(r.passed).toBe(false);
    expect(r.failures.join()).toContain("no runner");
  });
});
