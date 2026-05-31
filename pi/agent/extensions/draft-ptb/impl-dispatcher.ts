// Dispatch implementation subagents in DAG-ordered levels.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, FileContract, ImplementationResult } from "./state.ts";
import { runChildPi } from "./child-process.ts";
import { parseImplStatus } from "./status-parser.ts";
import { snapshotChangedPaths, diffSets, prepareWorkspace, backupFile } from "./workspace-setup.ts";
import { buildLevels } from "./dag.ts";
import { buildImplementerPrompt } from "./prompts/implementer.ts";
import { SONNET, OPUS, WRITE_TOOLS, MAX_IMPL_RETRIES } from "./models.ts";

export async function dispatchImplementation(
  state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext,
): Promise<ImplementationResult[]> {
  await prepareWorkspace(pi, ctx.cwd, state, ctx);
  const results: ImplementationResult[] = [];

  if (state.infraTask) {
    ctx.ui.notify(`🛠 Ejecutando tarea de infraestructura: ${state.infraTask.id}`, "info");
    const forbidden = state.fileContracts.map((c) => c.path);
    const r = await runOneImplementer({ state, pi, ctx }, null, state.infraTask.id, forbidden, SONNET);
    results.push(r);
    if (r.status === "BLOCKED") ctx.ui.notify(`⛔ Infraestructura BLOQUEADA: ${r.concerns ?? "(sin detalles)"}`, "error");
  }

  const dag = buildLevels(state.fileContracts);
  const sharedSet = new Set(state.sharedFiles);
  for (let i = 0; i < dag.levels.length; i++) {
    const level = dag.levels[i];
    ctx.ui.notify(`🧩 Nivel ${i + 1}/${dag.levels.length}: ${level.length} subagentes en paralelo`, "info");
    const levelResults = await Promise.all(
      level.map((node) => {
        const forbidden = [...sharedSet, ...state.fileContracts.filter((c) => c.path !== node.contract.path).map((c) => c.path)];
        return runOneImplementer({ state, pi, ctx }, node.contract, node.id, forbidden, SONNET);
      }),
    );
    results.push(...levelResults);
  }
  return results;
}

interface DispatchCtx { state: DraftState; pi: ExtensionAPI; ctx: ExtensionContext }

async function runOneImplementer(
  d: DispatchCtx, contract: FileContract | null, taskId: string,
  forbiddenFiles: string[], initialModel: { provider: string; model: string },
): Promise<ImplementationResult> {
  const isInfra = contract === null;
  const importedContracts = isInfra ? [] : d.state.fileContracts.filter((c) => contract!.imports.includes(c.path));
  const systemPrompt = buildImplementerPrompt({
    contract, importedContracts, forbiddenFiles,
    infraTask: d.state.infraTask, understanding: d.state.understanding,
    projectContext: d.state.compressedContext, planMarkdown: d.state.plan,
  });

  if (!d.state.gitInfo.hasGit) {
    const targets = isInfra ? d.state.infraTask?.files ?? [] : [contract!.path];
    for (const t of targets) await backupFile(d.ctx.cwd, t);
  }

  let model = initialModel;
  let needsContextRetries = 0;
  let lastConcerns: string | null = null;
  let blockedRetried = false;

  while (true) {
    const before = await snapshotChangedPaths(d.pi, d.ctx.cwd);
    const taskMsg = buildTaskMessage(contract, d.state.infraTask?.id ?? null, lastConcerns);
    const result = await runChildPi(
      {       provider: model.provider, model: model.model, systemPrompt, userTask: taskMsg, toolAllowlist: WRITE_TOOLS, cwd: d.ctx.cwd },
      taskId,
    );
    const after = await snapshotChangedPaths(d.pi, d.ctx.cwd);
    const newFiles = diffSets(before, after);

    if (result.exitCode !== 0) return { taskId, status: "BLOCKED", filesWritten: newFiles, commit: null, concerns: `child pi exited ${result.exitCode}: ${result.stderr.trim().slice(0, 400)}` };
    const violations = newFiles.filter((f) => forbiddenFiles.includes(f));
    if (violations.length > 0) return { taskId, status: "BLOCKED", filesWritten: newFiles, commit: null, concerns: `wrote to forbidden file(s): ${violations.join(", ")}` };

    const parsed = parseImplStatus(result.finalText);
    if (parsed.status === "NEEDS_CONTEXT" && needsContextRetries < MAX_IMPL_RETRIES) { needsContextRetries++; lastConcerns = parsed.concerns ?? "additional context requested"; continue; }
    if (parsed.status === "BLOCKED" && !blockedRetried) { blockedRetried = true; model = OPUS; lastConcerns = parsed.concerns ?? "previous attempt blocked"; continue; }
    return { taskId, status: parsed.status, filesWritten: newFiles, commit: null, concerns: parsed.concerns };
  }
}

function buildTaskMessage(contract: FileContract | null, infraId: string | null, lastConcerns: string | null): string {
  const base = contract === null
    ? `Implement the infra task "${infraId}". Follow the system prompt exactly.`
    : `Implement the file contract for \`${contract.path}\`. Follow the system prompt exactly.`;
  return lastConcerns ? `${base}\n\n## Additional context from previous attempt\n${lastConcerns}` : base;
}
