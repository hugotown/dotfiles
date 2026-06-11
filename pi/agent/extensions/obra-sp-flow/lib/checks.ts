// Step 6 deterministic verification. Runs typecheck/lint/test and reads
// coverage. Absent tests are a FAILURE (cannot verify), never a false green.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CheckResult, ChecksResult, Config } from "../types.ts";
import { detectLint, detectTest, detectTypecheck } from "./detect.ts";

function run(cwd: string, cmd: string): CheckResult {
  try {
    const out = execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 900_000 });
    return { name: cmd, passed: true, output: out.slice(-4000) };
  } catch (e: any) {
    const out = (String(e?.stdout ?? "") + String(e?.stderr ?? "")).slice(-4000);
    return { name: cmd, passed: false, output: out || String(e?.message ?? e) };
  }
}

function readCoverage(cwd: string): number | null {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(cwd, "coverage", "coverage-summary.json"), "utf-8"));
    const pct = j?.total?.lines?.pct;
    return typeof pct === "number" ? pct : null;
  } catch {
    return null;
  }
}

function binAvailable(cwd: string, cmd: string): boolean {
  const bin = cmd.trim().split(/\s+/)[0];
  try {
    execSync(`command -v ${bin}`, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function runChecks(cwd: string, config: Config): ChecksResult {
  const results: CheckResult[] = [];
  const failures: string[] = [];
  // mandatory checks (tests) fail when absent/missing; optional ones (typecheck,
  // lint) are skipped when the tool is not installed — no false failure, no false green.
  const consider = (cmd: string, label: string, mandatory: boolean) => {
    if (!cmd) {
      if (mandatory) {
        results.push({ name: label, passed: false, output: "No command configured/detected." });
        failures.push(`${label}: no runner (cannot verify)`);
      }
      return;
    }
    const bin = cmd.trim().split(/\s+/)[0];
    if (!binAvailable(cwd, cmd)) {
      if (mandatory) {
        results.push({ name: label, passed: false, output: `'${bin}' not installed; cannot verify.` });
        failures.push(`${label}: tool '${bin}' missing`);
      } else {
        results.push({ name: label, passed: true, skipped: true, output: `Skipped: '${bin}' not installed.` });
      }
      return;
    }
    const r = run(cwd, cmd);
    results.push({ name: label, passed: r.passed, output: r.output });
    if (!r.passed) failures.push(`${label}: failed`);
  };

  consider(config.checks.typecheck || detectTypecheck(cwd), "typecheck", false);
  consider(config.checks.lint || detectLint(cwd), "lint", false);
  consider(config.checks.test || detectTest(cwd), "test", true);

  const coverage = readCoverage(cwd);
  if (coverage !== null && coverage < config.limits.coverageThreshold) {
    failures.push(`coverage ${coverage}% < ${config.limits.coverageThreshold}%`);
  }
  return { results, coverage, passed: failures.length === 0, failures };
}
