// Deterministic checks driver — orchestrates typecheck, lint, tests, and workbooks.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, ChecksResult, WorkbookCheck } from "../state.ts";
import { runTypecheck } from "./typecheck.ts";
import { runLint } from "./lint.ts";
import { runTests } from "./test-runner.ts";
import { runOneWorkbook } from "./workbook.ts";

export async function runChecks(state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext): Promise<ChecksResult> {
  const types = state.projectInfo.types;

  ctx.ui.setStatus("draft-ptb", "🔎 typecheck");
  const typecheck = await runTypecheck(pi, ctx.cwd, types);

  ctx.ui.setStatus("draft-ptb", "🔎 lint");
  const lint = await runLint(pi, ctx.cwd, types);

  ctx.ui.setStatus("draft-ptb", "🔎 tests");
  const tests = await runTests(pi, ctx.cwd, types);

  const workbookPaths = state.testGenerationResults
    .filter((r) => r.artifact === "workbook" && r.status === "DONE")
    .map((r) => r.testPath);

  const workbooks: WorkbookCheck[] = [];
  for (const wb of workbookPaths) {
    ctx.ui.setStatus("draft-ptb", `🔎 wb ${wb}`);
    workbooks.push(await runOneWorkbook(pi, ctx.cwd, wb));
  }

  ctx.ui.setStatus("draft-ptb", undefined);
  return {
    typecheck: { passed: typecheck.passed, output: typecheck.output },
    lint: { passed: lint.passed, output: lint.output },
    tests: { passed: tests.passed, output: tests.output },
    workbooks,
  };
}
