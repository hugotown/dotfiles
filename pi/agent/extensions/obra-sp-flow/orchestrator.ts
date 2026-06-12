// Session-bound helpers: event-sourced persistence, context windowing, and
// per-phase model/tool routing. Mirrors the proven draft-ptb pattern.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FlowState, PhaseKey } from "./types.ts";

const STATE_ENTRY = "obra-sp-flow-state";
export const PHASE_MARKER = "obra-sp-flow-phase-marker";

export function persist(pi: ExtensionAPI, state: FlowState): void {
  pi.appendEntry(STATE_ENTRY, state);
}

export function restore(ctx: ExtensionContext): FlowState | null {
  const entries = ctx.sessionManager.getBranch();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as { type?: string; customType?: string; data?: FlowState };
    if (e.type === "custom" && e.customType === STATE_ENTRY && e.data) return e.data;
  }
  return null;
}

export function sendPhasePrompt(pi: ExtensionAPI, prompt: string): void {
  pi.sendMessage({ customType: PHASE_MARKER, content: prompt, display: true }, { triggerTurn: true });
}

export function filterContext(messages: unknown[]): unknown[] {
  let lastMarker = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i] as { customType?: string }).customType === PHASE_MARKER) {
      lastMarker = i;
      break;
    }
  }
  if (lastMarker === -1) return messages;
  const filtered = messages.slice(lastMarker);
  return filtered.length > 0 ? filtered : messages;
}

export async function applyPhaseConfig(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: FlowState,
  key: PhaseKey,
  tools: string[],
): Promise<boolean> {
  const pm = state.config.phases[key];
  const model = ctx.modelRegistry.find(pm.provider, pm.model);
  if (!model) {
    ctx.ui.notify(`Model ${pm.provider}/${pm.model} not found (phase ${key}).`, "error");
    return false;
  }
  const ok = await pi.setModel(model);
  if (!ok) {
    ctx.ui.notify(`No API key for ${pm.provider}/${pm.model}.`, "error");
    return false;
  }
  pi.setThinkingLevel(pm.thinking);
  pi.setActiveTools(tools);
  return true;
}

export function captureDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: FlowState): FlowState {
  const all = pi.getAllTools().map((t) => t.name);
  const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null;
  return { ...state, originalModel: model, allToolNames: all };
}

export async function restoreDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: FlowState): Promise<void> {
  if (state.allToolNames.length) pi.setActiveTools(state.allToolNames);
  if (state.originalModel) {
    const m = ctx.modelRegistry.find(state.originalModel.provider, state.originalModel.id);
    if (m) await pi.setModel(m);
  }
}
