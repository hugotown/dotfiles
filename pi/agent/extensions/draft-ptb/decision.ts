// Decision logic for the ITERATE_OR_SHIP phase.
// Pure functions: no I/O, no side effects.

import type { DraftState, ReviewIssue, ReviewResults, ChecksResult } from "./state.ts";

const ITERATION_CAP = 3;

export type Decision =
  | { kind: "ship" }
  | { kind: "iterate"; targets: string[]; reason: string }
  | { kind: "escalate"; reason: string };

export function decide(state: DraftState): Decision {
  if (state.iterationCount >= ITERATION_CAP) {
    return { kind: "escalate", reason: `iteration cap of ${ITERATION_CAP} reached` };
  }
  const checksFailed = hasFailedChecks(state.checksResult);
  const reviewBlocking = state.reviewResults ? hasBlockingIssues(state.reviewResults) : false;
  if (!checksFailed && !reviewBlocking) return { kind: "ship" };
  return { kind: "iterate", targets: collectTargets(state), reason: describeReason(state, checksFailed, reviewBlocking) };
}

export function collectTargets(state: DraftState): string[] {
  const set = new Set<string>();
  if (state.reviewResults) addBlockingFiles(state.reviewResults, set);
  if (state.checksResult) for (const f of extractPathsFromChecks(state.checksResult)) set.add(f);
  if (set.size === 0) for (const r of state.implementationResults) for (const f of r.filesWritten) set.add(f);
  return Array.from(set).sort();
}

function hasFailedChecks(checks: ChecksResult | null): boolean {
  if (!checks) return false;
  return !(checks.typecheck.passed && checks.lint.passed && checks.tests.passed && checks.workbooks.every((w) => w.passed));
}

function hasBlockingIssues(r: ReviewResults): boolean {
  for (const dim of [r.contracts, r.quality, r.tests]) {
    for (const issue of dim.issues) {
      if (issue.severity === "critical" || issue.severity === "important") return true;
    }
  }
  return false;
}

function addBlockingFiles(r: ReviewResults, set: Set<string>): void {
  const add = (issues: ReviewIssue[]) => {
    for (const i of issues) { if (i.severity !== "minor" && i.file !== "(reviewer)") set.add(i.file); }
  };
  add(r.contracts.issues);
  add(r.quality.issues);
  add(r.tests.issues);
}

function extractPathsFromChecks(checks: ChecksResult): string[] {
  const out = new Set<string>();
  const blobs = [checks.typecheck.output, checks.lint.output, checks.tests.output, ...checks.workbooks.map((w) => w.output)];
  const re = /(?<![\w/])([\w./-]+\.[a-zA-Z]{1,5})(?::\d+(?::\d+)?)?/g;
  for (const blob of blobs) {
    if (!blob) continue;
    for (const m of blob.matchAll(re)) {
      const p = m[1];
      if (p.startsWith("node_modules/") || p === "node.js" || p === "package.json") continue;
      out.add(p);
    }
  }
  return Array.from(out);
}

function describeReason(state: DraftState, checksFailed: boolean, reviewBlocking: boolean): string {
  const parts: string[] = [];
  if (checksFailed && state.checksResult) {
    const c = state.checksResult;
    const failed: string[] = [];
    if (!c.typecheck.passed) failed.push("typecheck");
    if (!c.lint.passed) failed.push("lint");
    if (!c.tests.passed) failed.push("tests");
    const wbFailed = c.workbooks.filter((w) => !w.passed).length;
    if (wbFailed > 0) failed.push(`${wbFailed} workbook(s)`);
    parts.push(`checks failed: ${failed.join(", ")}`);
  }
  if (reviewBlocking && state.reviewResults) {
    const r = state.reviewResults;
    const count = (issues: ReviewIssue[]) => issues.filter((i) => i.severity !== "minor").length;
    parts.push(`review issues: contracts=${count(r.contracts.issues)}, quality=${count(r.quality.issues)}, tests=${count(r.tests.issues)}`);
  }
  return parts.join("; ") || "unknown failure";
}
