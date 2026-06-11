// obra-sp-flow — one command runs the full superpowers pipeline:
// brainstorm (interactive) -> plan -> branch -> implement -> review -> verify
//   -> debug loop -> finish. Wiring only; logic lives in phases/ and lib/.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowEvent, FlowState } from "./types.ts";
import { createInitialState, transition } from "./reducer.ts";
import { captureDefaults, filterContext, persist, restore } from "./orchestrator.ts";
import { loadConfig } from "./lib/config-load.ts";
import { driveCurrentPhase } from "./drive.ts";
import { registerTools } from "./tools/index.ts";
import { registerInit } from "./commands/init.ts";
import { handleBrainstormEnd } from "./phases/brainstorm.ts";
import { appendMetric, type RecordMetric } from "./lib/metrics.ts";

export default function obraSpFlow(pi: ExtensionAPI): void {
  let state: FlowState | null = null;
  const getState = () => state;
  const setState = (s: FlowState) => {
    state = s;
  };
  // Token telemetry sink: a side-channel of dedicated session entries, decoupled
  // from the state machine. Summarized + written to disk at COMPLETE.
  const record: RecordMetric = (metric) => appendMetric(pi, metric);

  async function advance(ctx: ExtensionContext, event: FlowEvent): Promise<void> {
    if (!state) return;
    state = transition(state, event);
    persist(pi, state);
    await driveCurrentPhase(state, pi, ctx, advance, record);
  }

  pi.registerCommand("obra-sp-flow", {
    description: "Run the full superpowers pipeline (brainstorm -> ... -> finish) from one idea",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("obra-sp-flow requires an interactive UI.", "error");
        return;
      }
      const idea = args.trim();
      if (!idea) {
        ctx.ui.notify("Usage: /obra-sp-flow <describe your idea>", "warning");
        return;
      }
      // isProjectTrusted exists at runtime (pi >= 0.79); guard for older types.
      const trustFn = (ctx as { isProjectTrusted?: () => boolean }).isProjectTrusted;
      const trusted = typeof trustFn === "function" ? trustFn.call(ctx) : false;
      const config = loadConfig(ctx.cwd, trusted);
      state = captureDefaults(pi, ctx, createInitialState(idea, config));
      await advance(ctx, { type: "START" });
    },
  });

  registerInit(pi);
  registerTools(pi, getState, setState);

  pi.on("context", async (event) => {
    if (!state || state.phase === "IDLE" || state.phase === "COMPLETE") return;
    return { messages: filterContext(event.messages as unknown[]) as typeof event.messages };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!state || state.phase !== "BRAINSTORM") return;
    await handleBrainstormEnd(state, pi, ctx, advance);
  });

  pi.on("session_start", async (event, ctx) => {
    if (event.reason !== "resume" && event.reason !== "reload") return;
    const restored = restore(ctx);
    if (!restored || restored.phase === "IDLE" || restored.phase === "COMPLETE") return;
    state = restored;
    ctx.ui.notify(`obra-sp-flow resumed at phase: ${state.phase}`, "info");
    // Re-drive deterministic phases automatically (safe to repeat). LLM/child
    // phases are left for the user to resume to avoid duplicate paid work.
    if (state.phase === "BRANCH" || state.phase === "VERIFY" || state.phase === "FINISH") {
      await driveCurrentPhase(state, pi, ctx, advance, record);
    }
  });
}
