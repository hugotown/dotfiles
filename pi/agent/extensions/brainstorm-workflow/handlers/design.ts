// handlers/design.ts — Handle brainstorm_design + brainstorm_design_revision tool results
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { showDesignReview } from "../steps/design-review.ts";
import { getRevisionPrompt } from "../lib/prompts-design.ts";
import { type BrainstormOrchestrator, REVISION_TOOLS } from "../orchestrator.ts";
import { finishDesign } from "./review.ts";
import type { DesignSection } from "../types.ts";

export async function handleDesign(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  details: Record<string, any>,
): Promise<void> {
  const title: string = details.title ?? "Untitled";
  const sections: DesignSection[] = details.sections ?? [];

  orc.transition("DESIGN_RECEIVED", { title, sections });
  orc.persist();

  await reviewSections(orc, ctx, 0);
}

export async function handleDesignRevision(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  details: Record<string, any>,
): Promise<void> {
  const sectionId: string = details.section_id;
  const content: string = details.content;
  const wireframe = details.wireframe;

  // Update the section in state
  if (orc.state.design) {
    const idx = orc.state.design.sections.findIndex((s) => s.id === sectionId);
    if (idx >= 0) {
      orc.state.design.sections[idx] = { ...orc.state.design.sections[idx], content, wireframe };
    }
  }
  orc.persist();

  const startIdx = orc.state.design?.sections.findIndex((s) => s.id === sectionId) ?? 0;
  await reviewSections(orc, ctx, startIdx);
}

/** Walk sections from startIdx, requesting changes or finishing when all approved. */
async function reviewSections(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  startIdx: number,
): Promise<void> {
  const sections = orc.state.design!.sections;

  for (let i = startIdx; i < sections.length; i++) {
    const action = await showDesignReview(ctx, orc.state.design!.title, sections, i);

    if (action.type === "abort") {
      await orc.cancel(ctx);
      return;
    }

    if (action.type === "request_changes") {
      await orc.setModelToSonnet(ctx);
      orc.setActiveTools(REVISION_TOOLS);
      orc.sendMessage(getRevisionPrompt(sections[i].content, action.feedback));
      return;
    }
  }

  await finishDesign(orc, ctx);
}
