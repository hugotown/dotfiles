import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent, Answer, Question } from "./state.ts";
import { saveSpec, savePlan, saveBrainstorming } from "./file-ops.ts";
import { formatApproachesWidget } from "./prompts/format.ts";

export const APPROACHES_WIDGET_KEY = "draft-ptb-approaches";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

async function askOne(ctx: ExtensionContext, q: Question): Promise<string> {
  if (q.options && q.options.length > 0) {
    const choice = await ctx.ui.select(q.question, q.options);
    return choice ?? "";
  }
  const text = await ctx.ui.input(q.question);
  return text ?? "";
}

export async function handleAgentEnd(
  state: DraftState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "RESEARCH": {
      // The LLM has filled state.understanding + state.questions via draft_ptb_understanding.
      // Deterministically collect answers, optionally ask test opt-in, save brainstorming, advance.
      if (state.questions.length === 0) return;

      const answers: Answer[] = [];
      for (const q of state.questions) {
        const a = await askOne(ctx, q);
        answers.push({ question: q.question, answer: a });
      }

      // Test opt-in (only if the LLM detected potential test surface).
      const tr = state.understanding.testRequirements;
      const proposesTests = tr.wantsE2E || tr.wantsIntegration ||
        tr.fields.length > 0 || tr.functionalRequirements.length > 0;
      if (proposesTests) {
        const e2eOpts = ["Sí", "No"];
        const e2eChoice = await ctx.ui.select(
          `¿Quieres pruebas end-to-end (E2E) con agent-browser/playwright? Carpeta propuesta: ${state.projectInfo.testFolders.e2e}`,
          e2eOpts,
        );
        answers.push({ question: "wantsE2E", answer: e2eChoice ?? "No" });

        const intChoice = await ctx.ui.select(
          `¿Quieres pruebas de integración? Carpeta propuesta: ${state.projectInfo.testFolders.integration}`,
          e2eOpts,
        );
        answers.push({ question: "wantsIntegration", answer: intChoice ?? "No" });
      }

      const brainstormingPath = await saveBrainstorming(ctx, state);
      ctx.ui.notify(`📝 Brainstorming → ${brainstormingPath}`, "info");
      await advance(ctx, { type: "ANSWERS_COLLECTED", answers, brainstormingPath });
      break;
    }

    case "COMPLETENESS_CHECK": {
      const result = state.completenessResult;
      if (!result) return;
      if (result.complete || state.completenessIterations >= 3) {
        if (!result.complete && state.completenessIterations >= 3)
          ctx.ui.notify("⚠️ Completeness loop reached 3 iterations; advancing anyway.", "warning");
        await advance(ctx, { type: "COMPLETENESS_ADVANCE" });
      } else {
        ctx.ui.notify(`🔁 Faltan datos (${result.missingInfo.length}). Volviendo a research.`, "info");
        await advance(ctx, { type: "COMPLETENESS_LOOP", reason: result.missingInfo.join("; ") });
      }
      break;
    }

    case "APPROACHES": {
      if (state.approaches.length === 0) return;

      ctx.ui.setWidget(
        APPROACHES_WIDGET_KEY,
        formatApproachesWidget(state.approaches, state.recommendation),
        { placement: "aboveEditor" },
      );

      const labels = state.approaches.map((a, i) => {
        const letter = String.fromCharCode(65 + i);
        const star = state.recommendation === a.name ? " ⭐" : "";
        return `${letter} — ${a.name}${star}`;
      });
      const choice = await ctx.ui.select("Pick an approach (details above):", labels);

      const idx = labels.findIndex((l) => l === choice);
      const chosen = state.approaches[idx >= 0 ? idx : 0];
      await advance(ctx, { type: "APPROACH_CHOSEN", approach: chosen });
      break;
    }

    case "DESIGN": {
      if (!state.spec) return;
      const feedback = await ctx.ui.editor(
        "Review the spec (edit to provide feedback, or leave unchanged to approve):",
        state.spec,
      );
      const approved = !feedback?.trim() || feedback.trim() === state.spec.trim();
      if (approved) {
        const specPath = await saveSpec(ctx, state);
        await advance(ctx, { type: "SPEC_APPROVED", specPath });
      } else {
        await advance(ctx, { type: "SPEC_REVISION_REQUESTED", feedback: feedback! });
      }
      break;
    }

    case "PLAN": {
      if (!state.plan) return;
      const planPath = await savePlan(ctx, state);
      await advance(ctx, { type: "PLAN_SAVED", planPath });
      break;
    }
  }
}
