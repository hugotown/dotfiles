import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, Phase } from "./state.ts";
import { PHASE_CONFIG } from "./config.ts";

const STATE_ENTRY = "draft-ptb-state";
const PHASE_MARKER = "draft-ptb-phase-marker";

export function persist(pi: ExtensionAPI, state: DraftState): void {
  pi.appendEntry(STATE_ENTRY, state);
}

export function restore(ctx: ExtensionContext): DraftState | null {
  const entries = ctx.sessionManager.getBranch();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as { type?: string; customType?: string; data?: DraftState };
    if (e.type === "custom" && e.customType === STATE_ENTRY && e.data) return e.data;
  }
  return null;
}

export function sendPhasePrompt(pi: ExtensionAPI, prompt: string): void {
  pi.sendMessage(
    { customType: PHASE_MARKER, content: prompt, display: true },
    { triggerTurn: true },
  );
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

export async function applyPhaseConfig(pi: ExtensionAPI, ctx: ExtensionContext, phase: Phase): Promise<boolean> {
  const config = PHASE_CONFIG[phase];
  if (!config) return true;
  const model = ctx.modelRegistry.find(config.model.provider, config.model.id);
  if (!model) { ctx.ui.notify(`Model ${config.model.provider}/${config.model.id} not found.`, "error"); return false; }
  const ok = await pi.setModel(model);
  if (!ok) { ctx.ui.notify(`No API key for ${config.model.provider}/${config.model.id}.`, "error"); return false; }
  pi.setActiveTools(config.tools);
  return true;
}

export function captureDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: DraftState): DraftState {
  const all = pi.getAllTools().map((t) => t.name);
  const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null;
  return { ...state, originalModel: model, allToolNames: all };
}

export async function restoreDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: DraftState): Promise<void> {
  if (state.allToolNames.length) pi.setActiveTools(state.allToolNames);
  if (state.originalModel) {
    const m = ctx.modelRegistry.find(state.originalModel.provider, state.originalModel.id);
    if (m) await pi.setModel(m);
  }
}
