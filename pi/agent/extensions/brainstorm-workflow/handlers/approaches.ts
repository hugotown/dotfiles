// handlers/approaches.ts — Handle brainstorm_approaches tool result
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { showApproachSelector } from "../steps/approaches.ts";
import { getDesignPrompt } from "../lib/prompts-design.ts";
import { type BrainstormOrchestrator, DESIGN_TOOLS } from "../orchestrator.ts";
import type { Approach } from "../types.ts";

export async function handleApproaches(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  details: Record<string, any>,
): Promise<void> {
  const approaches: Approach[] = details.approaches ?? [];
  const recommendation: string = details.recommendation ?? "";
  const reasoning: string = details.recommendation_reasoning ?? "";

  orc.transition("APPROACHES_RECEIVED", { approaches, recommendation });
  orc.persist();

  const selection = await showApproachSelector(ctx, approaches, recommendation, reasoning);

  if (selection.cancelled || !selection.selectedId) {
    await orc.cancel(ctx);
    return;
  }

  orc.transition("APPROACH_SELECTED", { approachId: selection.selectedId });
  orc.persist();

  await orc.setModelToOpus(ctx);
  orc.setActiveTools(DESIGN_TOOLS);

  const selected = approaches.find((a) => a.id === selection.selectedId);
  const approachText = selected
    ? `${selected.title}: ${selected.summary}`
    : selection.selectedId;

  orc.sendMessage(getDesignPrompt(
    orc.state.compressedContext,
    orc.state.originalPrompt,
    approachText,
    orc.formatAssumptions(),
    orc.formatAnswers(),
  ));
}
