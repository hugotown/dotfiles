// index.ts — Extension entry: registers tools, flag, input handler, and event wiring
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BrainstormOrchestrator, BRAINSTORM_FLAG } from "./orchestrator.ts";
import { startWorkflow } from "./handlers/start.ts";
import { handleQuestions } from "./handlers/questions.ts";
import { handleApproaches } from "./handlers/approaches.ts";
import { handleDesign, handleDesignRevision } from "./handlers/design.ts";
import { handleReview } from "./handlers/review.ts";
import { registerBrainstormQuestions } from "./tools/brainstorm-questions.ts";
import { registerBrainstormApproaches } from "./tools/brainstorm-approaches.ts";
import { registerBrainstormDesign } from "./tools/brainstorm-design.ts";
import { registerBrainstormDesignRevision } from "./tools/brainstorm-design-revision.ts";
import { registerBrainstormReview } from "./tools/brainstorm-review.ts";
import type { BrainstormState } from "./state.ts";

export default function brainstormWorkflow(pi: ExtensionAPI): void {
  const orc = new BrainstormOrchestrator(pi);

  // Register custom tools
  registerBrainstormQuestions(pi);
  registerBrainstormApproaches(pi);
  registerBrainstormDesign(pi);
  registerBrainstormDesignRevision(pi);
  registerBrainstormReview(pi);

  // Register flag + announce for autocomplete discovery
  pi.registerFlag("brainstorm", { description: "Start a brainstorming session", type: "string" });
  pi.events.emit("flag:registered", { token: BRAINSTORM_FLAG, description: "Start a brainstorming session" });

  // Intercept input: handle --brainstorm token directly
  pi.on("input", async (event, ctx) => {
    if (!event.text.includes(BRAINSTORM_FLAG)) return { action: "continue" };
    const cleanedPrompt = event.text.split(BRAINSTORM_FLAG).join("").trim();
    await startWorkflow(orc, ctx, cleanedPrompt);
    return { action: "handled" };
  });

  // Dispatch tool results to the appropriate phase handler
  pi.on("tool_result", async (event, ctx) => {
    if (!orc.isActive() || !ctx.hasUI || !event.details) return;
    const { toolName, details } = event;

    if (toolName === "brainstorm_questions" && orc.state.phase === "RESEARCHING_AND_QUESTIONING") {
      await handleQuestions(orc, ctx, details);
    } else if (toolName === "brainstorm_approaches" && orc.state.phase === "PROPOSING_APPROACHES") {
      await handleApproaches(orc, ctx, details);
    } else if (toolName === "brainstorm_design" && orc.state.phase === "GENERATING_DESIGN") {
      await handleDesign(orc, ctx, details);
    } else if (toolName === "brainstorm_design_revision" && orc.state.phase === "DESIGN_REVIEW") {
      await handleDesignRevision(orc, ctx, details);
    } else if (toolName === "brainstorm_review" && orc.state.phase === "SELF_REVIEW") {
      await handleReview(orc, ctx, details);
    }
  });

  // Restore state on session start
  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === "brainstorm-state") {
        orc.state = entry.data as BrainstormState;
      }
    }
    if (orc.isActive()) {
      orc.allToolNames = pi.getAllTools().map((t) => t.name);
      ctx.ui.setStatus("brainstorm", ctx.ui.theme.fg("accent", `🧠 brainstorm: ${orc.state.phase}`));
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    if (orc.isActive()) ctx.ui.setStatus("brainstorm", ctx.ui.theme.fg("accent", `🧠 ${orc.state.phase}`));
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (!orc.isActive()) ctx.ui.setStatus("brainstorm", undefined);
  });

  // /brainstorm command as alternative trigger
  pi.registerCommand("brainstorm", {
    description: "Start a brainstorming session for design exploration",
    handler: async (args, ctx) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /brainstorm <your request>", "warning"); return; }
      pi.sendUserMessage(`--brainstorm ${args}`);
    },
  });
}
