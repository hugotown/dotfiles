import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftEvent, DraftState } from "./state.ts";
import { createInitialState, transition } from "./reducer.ts";
import { persist, restore, filterContext, captureDefaults } from "./orchestrator.ts";
import { registerTools } from "./tools.ts";
import { handleAgentEnd } from "./handlers.ts";
import { driveCurrentPhase } from "./drive-phase.ts";

export default function draftPtb(pi: ExtensionAPI): void {
  let state: DraftState | null = null;

  const getState = () => state;
  const setState = (s: DraftState) => { state = s; };

  async function advance(ctx: ExtensionContext, event: DraftEvent): Promise<void> {
    if (!state) return;
    state = transition(state, event);
    persist(pi, state);
    await driveCurrentPhase(state, pi, ctx, advance);
  }

  pi.registerCommand("draft-ptb", {
    description: "Orchestrated brainstorm → design → plan workflow (token-efficient)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) { ctx.ui.notify("draft-ptb requires an interactive UI.", "error"); return; }
      const idea = args.trim();
      if (!idea) { ctx.ui.notify("Usage: /draft-ptb <describe your idea>", "warning"); return; }
      state = captureDefaults(pi, ctx, createInitialState(idea));
      await advance(ctx, { type: "START" });
    },
  });

  pi.registerCommand("draft-ptb-cancel", {
    description: "Cancel the active draft-ptb workflow and restore session defaults",
    handler: async (_args, ctx) => {
      if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") {
        ctx.ui.notify("No active draft-ptb workflow to cancel.", "info");
        return;
      }
      await advance(ctx, { type: "RESET" });
      ctx.ui.notify("draft-ptb workflow cancelled.", "info");
    },
  });

  registerTools(pi, getState, setState);

  pi.on("context", async (event) => {
    if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") return;
    return { messages: filterContext(event.messages as unknown[]) as typeof event.messages };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") return;
    await handleAgentEnd(state, pi, ctx, advance);
  });

  pi.on("session_start", async (event, ctx) => {
    if (event.reason !== "resume" && event.reason !== "reload") return;
    const restored = restore(ctx);
    if (restored && restored.phase !== "IDLE" && restored.phase !== "COMPLETE") {
      state = restored;
      ctx.ui.notify(`draft-ptb resumed at phase: ${state.phase}`, "info");
    }
  });
}
