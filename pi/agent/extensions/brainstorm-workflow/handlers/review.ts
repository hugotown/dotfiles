// handlers/review.ts — Handle brainstorm_review + finishDesign + user review
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { writeSpec } from "../steps/write-spec.ts";
import { showSelfReview } from "../steps/self-review.ts";
import { showUserReview } from "../steps/user-review.ts";
import { getAutoFixPrompt, getReviewPrompt } from "../lib/prompts-design.ts";
import { type BrainstormOrchestrator, DESIGN_TOOLS, REVIEW_TOOLS } from "../orchestrator.ts";
import type { ReviewIssue } from "../types.ts";

export async function handleReview(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  details: Record<string, any>,
): Promise<void> {
  const status: "pass" | "issues_found" = details.status;
  const issues: ReviewIssue[] = details.issues ?? [];
  const summary: string = details.summary ?? "";

  orc.transition("REVIEW_RECEIVED", { result: { status, issues, summary } });
  orc.persist();

  if (status === "pass") {
    await handleUserReview(orc, ctx);
    return;
  }

  const reviewAction = await showSelfReview(ctx, issues, summary);

  if (reviewAction.type === "auto_fix") {
    await orc.setModelToSonnet(ctx);
    orc.setActiveTools(DESIGN_TOOLS);
    const issuesText = issues
      .map((i) => `[${i.severity}] ${i.section} — ${i.type}: ${i.description}\n  Suggestion: ${i.suggestion}`)
      .join("\n\n");
    const specContent = orc.state.design?.sections
      .map((s) => `## ${s.title}\n${s.content}`)
      .join("\n\n") ?? "";
    orc.sendMessage(getAutoFixPrompt(specContent, issuesText));
  } else {
    await handleUserReview(orc, ctx);
  }
}

/** Finish design: write spec + trigger self-review. */
export async function finishDesign(orc: BrainstormOrchestrator, ctx: ExtensionContext): Promise<void> {
  orc.transition("DESIGN_APPROVED");
  orc.persist();

  const specPath = await writeSpec(ctx.cwd, {
    title: orc.state.design!.title,
    selectedApproach: orc.state.approaches.find((a) => a.id === orc.state.selectedApproach)?.title ?? "",
    assumptions: orc.state.assumptions,
    answers: orc.state.answers,
    questions: orc.state.questions,
    sections: orc.state.design!.sections,
  });

  orc.transition("SPEC_WRITTEN", { specPath });
  orc.persist();

  await orc.setModelToOpus(ctx);
  orc.setActiveTools(REVIEW_TOOLS);
  const specContent = orc.state.design!.sections
    .map((s) => `## ${s.title}\n${s.content}`)
    .join("\n\n");
  orc.sendMessage(getReviewPrompt(specContent));
}

/** Final user review of the spec. */
async function handleUserReview(orc: BrainstormOrchestrator, ctx: ExtensionContext): Promise<void> {
  const userAction = await showUserReview(ctx, orc.state.specPath!);

  if (userAction.type === "approve") {
    orc.transition("USER_APPROVED");
    orc.restoreTools();
    await orc.restoreModel(ctx);
    orc.persist();
    ctx.ui.notify(`✓ Brainstorming complete\n  Spec: ${orc.state.specPath}`, "info");
  } else if (userAction.type === "request_changes") {
    await orc.setModelToSonnet(ctx);
    orc.setActiveTools(DESIGN_TOOLS);
    orc.sendMessage(`Apply these changes to the design: ${userAction.feedback}`);
  } else {
    await orc.cancel(ctx);
  }
}
