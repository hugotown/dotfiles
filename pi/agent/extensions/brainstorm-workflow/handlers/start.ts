// handlers/start.ts — Start the brainstorm workflow
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { gatherContext } from "../steps/gather-context.ts";
import { getResearchPrompt } from "../lib/prompts-research.ts";
import { createInitialState, transition } from "../state.ts";
import { type BrainstormOrchestrator, BRAINSTORM_FLAG, RESEARCH_TOOLS } from "../orchestrator.ts";

export async function startWorkflow(
  orc: BrainstormOrchestrator,
  ctx: ExtensionContext,
  cleanedPrompt: string,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify(`${BRAINSTORM_FLAG} requires interactive UI.`, "error");
    return;
  }
  if (!cleanedPrompt.trim()) {
    ctx.ui.notify("Usage: --brainstorm <your request>", "warning");
    return;
  }

  const prompt = cleanedPrompt.trim();
  orc.allToolNames = orc.pi.getAllTools().map((t) => t.name);

  orc.state = transition(createInitialState(), "START", { prompt });
  orc.persist();
  ctx.ui.notify("🧠 Brainstorming started — gathering context...", "info");

  const compressedContext = await gatherContext(orc.pi, ctx.cwd, ctx.signal);
  orc.transition("CONTEXT_GATHERED", { compressedContext });
  orc.persist();

  await orc.setModelToSonnet(ctx);
  orc.setActiveTools(RESEARCH_TOOLS);
  orc.sendMessage(getResearchPrompt(orc.state.compressedContext, orc.state.originalPrompt));
}
