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
import { handleBrainstormEnd, handleBrainstormToolResult } from "./phases/brainstorm.ts";
import { compressBrainstorm } from "./phases/brainstorm/compress.ts";
import { renderLedger } from "./phases/brainstorm/ledger.ts";
import type { BrainstormScratch } from "./phases/brainstorm/types.ts";
import { PROGRESS_ENTRY } from "./lib/progress.ts";
import { appendMetric, type RecordMetric } from "./lib/metrics.ts";
import { initLogger, logEvent } from "./lib/observability.ts";

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
    logEvent({ event: "phase", phase: state.phase, trigger: event.type });
    try {
      await driveCurrentPhase(state, pi, ctx, advance, record);
    } catch (err) {
      // A thrown phase must NEVER freeze the pipeline mid-flow (the failure mode
      // that left the flow stuck in DEBUG all night). Surface the error and drive
      // to a clean terminal state so the persisted state stays consistent.
      const reason = `Phase ${state.phase} threw: ${String(err).slice(0, 300)}`;
      ctx.ui.notify(`⛔ obra-sp-flow error: ${reason}`, "error");
      logEvent({ event: "error", phase: state.phase, reason });
      if (state.phase !== "COMPLETE") {
        state = transition(state, { type: "ESCALATE", reason });
        persist(pi, state);
        try {
          await driveCurrentPhase(state, pi, ctx, advance, record);
        } catch {
          /* terminal render failed; state is already persisted as COMPLETE */
        }
      }
    }
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
      const logger = initLogger(ctx.cwd, idea);
      logEvent({ event: "start", idea, cwd: ctx.cwd });
      if (logger.path) ctx.ui.notify(`Observability log: ${logger.path}`, "info");
      await advance(ctx, { type: "START" });
    },
  });

  registerInit(pi);
  registerTools(pi, getState, setState);

  pi.on("context", async (event) => {
    // Progress entries are visual-only — never feed them to the LLM. Strip them
    // ALWAYS, even at IDLE/COMPLETE: otherwise, once the flow ends, the controller
    // LLM sees a dangling "🔬 …" progress line and treats it as a user instruction.
    let msgs = (event.messages as unknown[]).filter((m) => (m as { customType?: string }).customType !== PROGRESS_ENTRY);
    if (state && state.phase !== "IDLE" && state.phase !== "COMPLETE") {
      const bs = state.scratch.brainstorm as BrainstormScratch | undefined;
      // Compress to [marker, ledger] ONLY once the question loop has a ledger
      // (rounds > 0); during grounding keep the window so exploration isn't erased.
      const compress = state.phase === "BRAINSTORM" && bs?.node === "questions" && bs.rounds > 0;
      msgs = compress ? compressBrainstorm(msgs, renderLedger(bs as BrainstormScratch)) : filterContext(msgs);
    }
    return { messages: msgs as typeof event.messages };
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!state || state.phase !== "BRAINSTORM") return;
    handleBrainstormToolResult(state, pi, ctx, event.toolName, event.input, event.details);
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
    initLogger(ctx.cwd, state.idea);
    logEvent({ event: "resume", phase: state.phase });
    ctx.ui.notify(`obra-sp-flow resumed at phase: ${state.phase}`, "info");
    // Re-drive deterministic phases automatically (safe to repeat). LLM/child
    // phases are left for the user to resume to avoid duplicate paid work.
    if (state.phase === "BRANCH" || state.phase === "VERIFY" || state.phase === "FINISH") {
      await driveCurrentPhase(state, pi, ctx, advance, record);
    }
  });
}
