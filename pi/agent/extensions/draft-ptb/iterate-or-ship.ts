// ITERATE_OR_SHIP phase — pure orchestration code (no LLM).
//
// Decides whether to:
//   - SHIP: commit + push + create PR (when reviews are approved and checks pass)
//   - ITERATE: re-dispatch implementers for files flagged by reviewers / failed checks
//   - ESCALATE: notify the user with per-iteration history and stop (iteration cap)
//
// Hard iteration cap: 3. Beyond that we never auto-fix — the user must intervene.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, ReviewIssue, ReviewResults, ShipResult, ChecksResult } from "./state.ts";
import { commitAll, pushBranch, createPR, detectGhCli, isProtectedBranch } from "./git-ops.ts";

const ITERATION_CAP = 3;

export type Decision =
  | { kind: "ship" }
  | { kind: "iterate"; targets: string[]; reason: string }
  | { kind: "escalate"; reason: string };

/**
 * Decide ship vs iterate vs escalate based on review results AND deterministic checks.
 *
 * Inputs considered:
 *  - state.reviewResults (null if we landed here from failed checks without review)
 *  - state.checksResult
 *  - state.iterationCount
 *
 * Rules:
 *  - If iterationCount has reached the cap → escalate (no more auto-fixes).
 *  - If checks failed → iterate on every file touched by impl + workbook paths.
 *  - If reviews report any critical OR important issue → iterate on issue.file paths.
 *  - If reviews report only minor issues (or none) and checks passed → ship.
 *  - If no reviews ran (reviewResults === null) and checks failed → iterate.
 *  - If no reviews ran and checks passed (shouldn't happen — reducer would route via
 *    LLM_REVIEW first) → ship defensively.
 */
export function decide(state: DraftState): Decision {
  if (state.iterationCount >= ITERATION_CAP) {
    return { kind: "escalate", reason: `iteration cap of ${ITERATION_CAP} reached` };
  }

  const checksFailed = state.checksResult
    ? !(state.checksResult.typecheck.passed &&
        state.checksResult.lint.passed &&
        state.checksResult.tests.passed &&
        state.checksResult.workbooks.every((w) => w.passed))
    : false;

  const reviewBlocking = state.reviewResults ? hasBlockingIssues(state.reviewResults) : false;

  if (!checksFailed && !reviewBlocking) {
    return { kind: "ship" };
  }

  const targets = collectTargets(state);
  const reason = describeReason(state, checksFailed, reviewBlocking);
  return { kind: "iterate", targets, reason };
}

function hasBlockingIssues(r: ReviewResults): boolean {
  for (const dim of [r.contracts, r.quality, r.tests]) {
    for (const issue of dim.issues) {
      if (issue.severity === "critical" || issue.severity === "important") return true;
    }
  }
  return false;
}

/**
 * Build the set of target file paths to re-implement:
 *  - All `issue.file` from blocking review issues (deduped).
 *  - All `filesWritten` from implementation tasks that had concerns (best effort).
 *  - File paths extracted from failed check outputs.
 */
export function collectTargets(state: DraftState): string[] {
  const set = new Set<string>();

  if (state.reviewResults) {
    const addBlocking = (issues: ReviewIssue[]) => {
      for (const i of issues) {
        if (i.severity === "minor") continue;
        if (i.file && i.file !== "(reviewer)") set.add(i.file);
      }
    };
    addBlocking(state.reviewResults.contracts.issues);
    addBlocking(state.reviewResults.quality.issues);
    addBlocking(state.reviewResults.tests.issues);
  }

  if (state.checksResult) {
    for (const f of extractPathsFromChecks(state.checksResult)) set.add(f);
  }

  // If still empty (e.g. reviewer-meta-failure with file="(reviewer)"), fall back to
  // every file touched by implementation — better to re-run all than to no-op.
  if (set.size === 0) {
    for (const r of state.implementationResults) {
      for (const f of r.filesWritten) set.add(f);
    }
  }

  return Array.from(set).sort();
}

/**
 * Extract file paths from check outputs using a permissive regex that catches the
 * common compiler/lint output shape `path/to/file.ext:LINE:COL`.
 */
function extractPathsFromChecks(checks: ChecksResult): string[] {
  const out = new Set<string>();
  const blobs = [checks.typecheck.output, checks.lint.output, checks.tests.output, ...checks.workbooks.map((w) => w.output)];
  const re = /(?<![\w/])([\w./-]+\.[a-zA-Z]{1,5})(?::\d+(?::\d+)?)?/g;
  for (const blob of blobs) {
    if (!blob) continue;
    for (const m of blob.matchAll(re)) {
      const p = m[1];
      // Skip obvious noise.
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
    const counts = (issues: ReviewIssue[]) =>
      issues.filter((i) => i.severity === "critical").length +
      issues.filter((i) => i.severity === "important").length;
    const c = counts(r.contracts.issues);
    const q = counts(r.quality.issues);
    const t = counts(r.tests.issues);
    parts.push(`review issues: contracts=${c}, quality=${q}, tests=${t}`);
  }
  return parts.join("; ") || "unknown failure";
}

// ---------- ship ----------

/**
 * Commit + push + create PR. Returns a ShipResult describing what actually happened.
 * Safe to call when there is nothing to commit (returns committed=false, pushed=false).
 */
export async function ship(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<ShipResult> {
  // No-git mode: nothing to push. Just notify and report a "shipped, backed up" result.
  if (!state.gitInfo.hasGit) {
    ctx.ui.notify(
      `📦 Sin git: los cambios están aplicados. Respaldo de archivos originales en .draft-ptb-backup/`,
      "info",
    );
    return { committed: false, pushed: false, prUrl: null, failed: false, failureReason: null };
  }

  const branch = state.gitInfo.featureBranch ?? state.gitInfo.currentBranch;
  if (!branch || isProtectedBranch(branch)) {
    ctx.ui.notify(
      `⛔ No se puede subir desde la rama protegida "${branch ?? "(desconocida)"}". Cambia a una rama de feature primero.`,
      "error",
    );
    return {
      committed: false,
      pushed: false,
      prUrl: null,
      failed: true,
      failureReason: `cannot push from protected branch: ${branch ?? "unknown"}`,
    };
  }

  // Commit (no-op if M3 already committed every file).
  const message = buildCommitMessage(state);
  const commit = await commitAll(pi, ctx.cwd, message);
  if (commit.reason && !commit.committed && commit.reason !== "nothing to commit") {
    ctx.ui.notify(`⚠️ commit falló: ${commit.reason}`, "warning");
  }

  // Push.
  const push = await pushBranch(pi, ctx.cwd, branch);
  if (!push.pushed) {
    ctx.ui.notify(`⛔ push falló: ${push.reason ?? "(sin detalle)"}`, "error");
    return {
      committed: commit.committed,
      pushed: false,
      prUrl: null,
      failed: true,
      failureReason: `push failed: ${push.reason ?? "unknown"}`,
    };
  }

  // PR (best-effort: skip if `gh` is missing).
  const ghAvailable = await detectGhCli(pi);
  if (!ghAvailable) {
    ctx.ui.notify(
      `ℹ️ El CLI \`gh\` no está instalado. Rama subida; crea el PR manualmente en GitHub.`,
      "info",
    );
    return { committed: commit.committed, pushed: true, prUrl: null, failed: false, failureReason: null };
  }

  const baseBranch = state.gitInfo.baseBranch ?? "main";
  const title = buildPrTitle(state);
  const body = buildPrBody(state);
  const pr = await createPR(pi, ctx.cwd, baseBranch, title, body);
  if (!pr.url) {
    ctx.ui.notify(`⚠️ gh pr create no devolvió URL: ${pr.reason ?? "(sin detalle)"}`, "warning");
    return { committed: commit.committed, pushed: true, prUrl: null, failed: false, failureReason: null };
  }

  ctx.ui.notify(`🚀 PR creado: ${pr.url}`, "info");
  return { committed: commit.committed, pushed: true, prUrl: pr.url, failed: false, failureReason: null };
}

function slugify(s: string): string {
  return s.slice(0, 50).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/(^-+|-+$)/g, "") || "feature";
}

function buildCommitMessage(state: DraftState): string {
  return `feat: ${slugify(state.idea)}`;
}

function buildPrTitle(state: DraftState): string {
  // Use the spec title when available, fall back to the slug.
  return state.specTitle?.trim() || `feat: ${slugify(state.idea)}`;
}

function buildPrBody(state: DraftState): string {
  const lines: string[] = [];
  lines.push(`## Summary`, ``, state.idea, ``);
  lines.push(`## Plan`, ``);
  lines.push(`- Spec: \`${state.specPath ?? "(none)"}\``);
  lines.push(`- Plan: \`${state.planPath ?? "(none)"}\``);
  lines.push(`- Brainstorming: \`${state.brainstormingPath ?? "(none)"}\``);
  lines.push(``);
  lines.push(`## Implementation`, ``);
  lines.push(`- ${state.implementationResults.length} task(s) dispatched in parallel`);
  const blocked = state.implementationResults.filter((r) => r.status === "BLOCKED").length;
  const concerns = state.implementationResults.filter((r) => r.status === "DONE_WITH_CONCERNS").length;
  lines.push(`- ${blocked} blocked, ${concerns} done with concerns, ${state.implementationResults.length - blocked - concerns} clean`);
  if (state.testGenerationResults.length > 0) {
    const tBlocked = state.testGenerationResults.filter((r) => r.status === "BLOCKED").length;
    lines.push(`- ${state.testGenerationResults.length} test artifact(s) generated, ${tBlocked} blocked`);
  }
  lines.push(``);
  if (state.checksResult) {
    const c = state.checksResult;
    lines.push(`## Deterministic checks`, ``);
    lines.push(`- typecheck: ${c.typecheck.passed ? "✓" : "✗"}`);
    lines.push(`- lint: ${c.lint.passed ? "✓" : "✗"}`);
    lines.push(`- tests: ${c.tests.passed ? "✓" : "✗"}`);
    if (c.workbooks.length > 0) {
      const wbOk = c.workbooks.filter((w) => w.passed).length;
      lines.push(`- workbooks: ${wbOk}/${c.workbooks.length} passing`);
    }
    lines.push(``);
  }
  if (state.reviewResults) {
    const r = state.reviewResults;
    lines.push(`## LLM review`, ``);
    lines.push(`- contracts: ${r.contracts.approved ? "✓" : "✗"} (${r.contracts.issues.length} issues)`);
    lines.push(`- quality: ${r.quality.approved ? "✓" : "✗"} (${r.quality.issues.length} issues)`);
    lines.push(`- tests: ${r.tests.approved ? "✓" : "✗"} (${r.tests.issues.length} issues)`);
    lines.push(``);
  }
  if (state.iterationCount > 0) {
    lines.push(`## Iterations`, ``, `Review/fix loop ran ${state.iterationCount} time(s) before shipping.`, ``);
  }
  return lines.join("\n");
}

// ---------- escalate ----------

/**
 * Build a human-readable summary for the iteration-cap escalation notify. Returns a
 * single multi-line string. We surface every iteration's reason + the file targets
 * so the user can decide what to do.
 */
export function buildEscalationSummary(state: DraftState): string {
  const lines: string[] = [];
  lines.push(
    `🛑 draft-ptb llegó al límite de ${ITERATION_CAP} iteraciones de revisión-y-arreglo sin pasar.`,
    `   Necesitas intervenir manualmente para no entrar en un bucle infinito.`,
    ``,
  );

  if (state.iterationHistory.length === 0) {
    lines.push(`No hay historial de iteraciones registrado.`);
  } else {
    lines.push(`Historial:`);
    for (const it of state.iterationHistory) {
      lines.push(`  - Iteración ${it.iteration}: ${it.reason}`);
      if (it.failedFiles.length > 0) {
        const shown = it.failedFiles.slice(0, 5).join(", ");
        const extra = it.failedFiles.length > 5 ? ` (+${it.failedFiles.length - 5} más)` : "";
        lines.push(`    archivos afectados: ${shown}${extra}`);
      }
    }
  }

  if (state.checksResult) {
    const c = state.checksResult;
    lines.push(``, `Último estado de checks:`);
    lines.push(`  - typecheck: ${c.typecheck.passed ? "OK" : "FAIL"}`);
    lines.push(`  - lint: ${c.lint.passed ? "OK" : "FAIL"}`);
    lines.push(`  - tests: ${c.tests.passed ? "OK" : "FAIL"}`);
    const wbFailed = c.workbooks.filter((w) => !w.passed).length;
    if (c.workbooks.length > 0) {
      lines.push(`  - workbooks: ${c.workbooks.length - wbFailed}/${c.workbooks.length} OK`);
    }
  }

  if (state.reviewResults) {
    const r = state.reviewResults;
    const totalBlocking =
      r.contracts.issues.filter((i) => i.severity !== "minor").length +
      r.quality.issues.filter((i) => i.severity !== "minor").length +
      r.tests.issues.filter((i) => i.severity !== "minor").length;
    lines.push(``, `Última revisión: ${totalBlocking} issues no-menores pendientes.`);
  }

  return lines.join("\n");
}
