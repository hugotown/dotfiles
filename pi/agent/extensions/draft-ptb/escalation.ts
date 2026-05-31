// Build a human-readable escalation summary when the iteration cap is reached.

import type { DraftState } from "./state.ts";

const ITERATION_CAP = 3;

export function buildEscalationSummary(state: DraftState): string {
  const lines: string[] = [];
  lines.push(
    `🛑 draft-ptb llegó al límite de ${ITERATION_CAP} iteraciones sin pasar.`,
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

  appendChecksStatus(lines, state);
  appendReviewStatus(lines, state);
  return lines.join("\n");
}

function appendChecksStatus(lines: string[], state: DraftState): void {
  if (!state.checksResult) return;
  const c = state.checksResult;
  lines.push(``, `Último estado de checks:`);
  lines.push(`  - typecheck: ${c.typecheck.passed ? "OK" : "FAIL"}`);
  lines.push(`  - lint: ${c.lint.passed ? "OK" : "FAIL"}`);
  lines.push(`  - tests: ${c.tests.passed ? "OK" : "FAIL"}`);
  const wbFailed = c.workbooks.filter((w) => !w.passed).length;
  if (c.workbooks.length > 0) lines.push(`  - workbooks: ${c.workbooks.length - wbFailed}/${c.workbooks.length} OK`);
}

function appendReviewStatus(lines: string[], state: DraftState): void {
  if (!state.reviewResults) return;
  const r = state.reviewResults;
  const totalBlocking =
    r.contracts.issues.filter((i) => i.severity !== "minor").length +
    r.quality.issues.filter((i) => i.severity !== "minor").length +
    r.tests.issues.filter((i) => i.severity !== "minor").length;
  lines.push(``, `Última revisión: ${totalBlocking} issues no-menores pendientes.`);
}
