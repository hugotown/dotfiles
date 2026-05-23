// handlers/questions.ts — Handle brainstorm_questions tool result
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { showQuestionsForm } from "../steps/questions.ts";
import { getApproachesPrompt } from "../lib/prompts-research.ts";
import { type BrainstormOrchestrator, APPROACH_TOOLS } from "../orchestrator.ts";
import type { Assumption, Question } from "../types.ts";

export async function handleQuestions(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  details: Record<string, any>,
): Promise<void> {
  const assumptions: Assumption[] = details.assumptions ?? [];
  const questions: Question[] = details.questions ?? [];
  const done: boolean = details.done ?? false;

  orc.transition("QUESTIONS_RECEIVED", { assumptions, questions });
  orc.persist();

  const formResult = await showQuestionsForm(
    ctx,
    orc.state.assumptions,
    orc.state.questions,
    orc.state.originalPrompt.slice(0, 50),
  );

  if (formResult.cancelled) {
    await orc.cancel(ctx);
    return;
  }

  orc.transition("FORM_CONFIRMED", { answers: formResult.answers, done });
  orc.persist();

  if (formResult.feedback) {
    const feedbackPrompt = [
      "The user provided feedback instead of answering questions individually.",
      "Based on their feedback, either:",
      "1. Reformulate your assumptions and questions if the feedback corrects misunderstandings.",
      "2. Proceed directly to proposing approaches if the feedback already answers all open questions.",
      "",
      "User feedback:",
      formResult.feedback,
    ].join("\n");
    orc.sendMessage(feedbackPrompt);
  } else if (done || formResult.skipped) {
    orc.setActiveTools(APPROACH_TOOLS);
    const prompt = getApproachesPrompt(
      orc.state.compressedContext,
      orc.state.originalPrompt,
      orc.formatAssumptions(),
      orc.formatAnswers(),
    );
    orc.sendMessage(prompt);
  } else {
    orc.sendMessage("Continue researching and ask follow-up questions.");
  }
}
