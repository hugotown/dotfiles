// Dispatch test generation subagents with bounded concurrency.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, TestContract, TestGenerationResult } from "./state.ts";
import { runChildPi } from "./child-process.ts";
import { parseTestStatus } from "./status-parser.ts";
import { backupFile } from "./workspace-setup.ts";
import { buildTestGeneratorPrompt } from "./prompts/test-generation.ts";
import { SONNET, WRITE_TOOLS } from "./models.ts";

const TEST_CONCURRENCY = 4;

export async function dispatchTestGeneration(
  state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext,
): Promise<TestGenerationResult[]> {
  const results: TestGenerationResult[] = new Array(state.testContracts.length);
  let cursor = 0;
  const total = state.testContracts.length;
  const workerCount = Math.min(TEST_CONCURRENCY, total);
  const workers: Promise<void>[] = [];

  for (let w = 0; w < workerCount; w++) {
    workers.push((async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= total) return;
        const contract = state.testContracts[idx];
        ctx.ui.notify(`🧪 Generando test ${idx + 1}/${total}: ${contract.path}`, "info");
        results[idx] = await runOneTestGenerator(state, ctx, contract);
      }
    })());
  }

  await Promise.all(workers);
  return results;
}

async function runOneTestGenerator(
  state: DraftState, ctx: ExtensionContext, contract: TestContract,
): Promise<TestGenerationResult> {
  const journey =
    state.testSurface?.journeys.find((j) => j.id === contract.journey) ??
    state.testSurface?.integrationBoundaries.find((b) => b.id === contract.journey) ?? null;

  const codeUnderTest = state.fileContracts.filter((c) => contract.codeContractsUnderTest.includes(c.path));
  const systemPrompt = buildTestGeneratorPrompt({
    contract, journey, codeUnderTest, projectInfo: state.projectInfo, surface: state.testSurface,
  });

  if (!state.gitInfo.hasGit) await backupFile(ctx.cwd, contract.path);

  const result = await runChildPi(
    { provider: SONNET.provider, model: SONNET.model, systemPrompt, userTask: `Generate the ${contract.kind} test artifact at \`${contract.path}\`. Follow the system prompt exactly.`, toolAllowlist: WRITE_TOOLS, cwd: ctx.cwd },
    `test-${contract.path.replace(/[^a-z0-9]/gi, "_")}`,
  );

  if (result.exitCode !== 0) return { testPath: contract.path, status: "BLOCKED", artifact: contract.kind };
  const parsed = parseTestStatus(result.finalText);
  return { testPath: contract.path, status: parsed.status, artifact: contract.kind };
}
