// Handlers for research and completeness phases (agent_end events).

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent, Answer, Question } from "./state.ts";
import { saveBrainstorming } from "./file-ops.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function handleResearchEnd(state: DraftState, ctx: ExtensionContext, advance: Advance): Promise<void> {
  if (state.questions.length === 0) return;
  const answers: Answer[] = [];
  for (const q of state.questions) answers.push({ question: q.question, answer: await askOne(ctx, q) });

  const tr = state.understanding.testRequirements;
  const proposesTests = tr.wantsE2E || tr.wantsIntegration || tr.fields.length > 0 || tr.functionalRequirements.length > 0;
  if (proposesTests) {
    const opts = ["Sí", "No"];
    const e2e = await ctx.ui.select(`¿Quieres pruebas E2E? Carpeta propuesta: ${state.projectInfo.testFolders.e2e}`, opts);
    answers.push({ question: "wantsE2E", answer: e2e ?? "No" });
    const int = await ctx.ui.select(`¿Quieres pruebas de integración? Carpeta: ${state.projectInfo.testFolders.integration}`, opts);
    answers.push({ question: "wantsIntegration", answer: int ?? "No" });
  }

  const brainstormingPath = await saveBrainstorming(ctx, state);
  ctx.ui.notify(`📝 Brainstorming → ${brainstormingPath}`, "info");
  await advance(ctx, { type: "ANSWERS_COLLECTED", answers, brainstormingPath });
}

export async function handleCompletenessEnd(state: DraftState, ctx: ExtensionContext, advance: Advance): Promise<void> {
  const result = state.completenessResult;
  if (!result) return;
  if (result.complete || state.completenessIterations >= 3) {
    if (!result.complete) ctx.ui.notify("⚠️ Completeness loop reached 3 iterations; advancing anyway.", "warning");
    await advance(ctx, { type: "COMPLETENESS_ADVANCE" });
  } else {
    ctx.ui.notify(`🔁 Faltan datos (${result.missingInfo.length}). Volviendo a research.`, "info");
    await advance(ctx, { type: "COMPLETENESS_LOOP", reason: result.missingInfo.join("; ") });
  }
}

async function askOne(ctx: ExtensionContext, q: Question): Promise<string> {
  if (q.options && q.options.length > 0) return (await ctx.ui.select(q.question, q.options)) ?? "";
  return (await ctx.ui.input(q.question)) ?? "";
}
