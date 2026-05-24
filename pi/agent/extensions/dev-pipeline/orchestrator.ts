import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PHASE_CONFIG, type ModelRef } from "./lib/models.ts";
import type { Phase, PipelineState } from "./state.ts";

export const STATE_ENTRY = "dev-pipeline-state";
const PHASE_MARKER = "dev-pipeline-phase-marker";

/** Persist the full state after every transition (NFR-4 resumability). */
export function persist(pi: ExtensionAPI, state: PipelineState): void {
	pi.appendEntry(STATE_ENTRY, state);
}

/** Restore the latest persisted state on the current branch, or null if none (FR-4). */
export function restore(ctx: ExtensionContext): PipelineState | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i] as { type?: string; customType?: string; data?: PipelineState };
		if (e.type === "custom" && e.customType === STATE_ENTRY && e.data) {
			return e.data;
		}
	}
	return null;
}

/** Apply the model + tool scope for a phase (FR-27, FR-29). Returns false if the model is unavailable. */
export async function applyPhaseConfig(pi: ExtensionAPI, ctx: ExtensionContext, phase: Phase): Promise<boolean> {
	const config = PHASE_CONFIG[phase];
	if (!config) return true; // non-LLM phase
	const model = ctx.modelRegistry.find(config.model.provider, config.model.id);
	if (!model) {
		ctx.ui.notify(`Model ${config.model.provider}/${config.model.id} not found.`, "error");
		return false;
	}
	const ok = await pi.setModel(model);
	if (!ok) {
		ctx.ui.notify(`No API key for ${config.model.provider}/${config.model.id}.`, "error");
		return false;
	}
	pi.setActiveTools(config.tools);
	return true;
}

/** Capture the session defaults so they can be restored at COMPLETE / RESET (FR-8.restore). */
export function captureDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: PipelineState): PipelineState {
	const all = pi.getAllTools().map((t) => t.name);
	const model = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null;
	return { ...state, originalModel: model, allToolNames: all };
}

/** Restore the original model + tools (COMPLETE / RESET / abort). */
export async function restoreDefaults(pi: ExtensionAPI, ctx: ExtensionContext, state: PipelineState): Promise<void> {
	if (state.allToolNames.length) pi.setActiveTools(state.allToolNames);
	if (state.originalModel) {
		const m = ctx.modelRegistry.find(state.originalModel.provider, state.originalModel.id);
		if (m) await pi.setModel(m);
	}
}

/**
 * Inject a hidden marker, then the phase prompt, triggering a turn.
 * The marker lets the context filter trim everything before this phase (FR-28).
 */
export function drivePhase(pi: ExtensionAPI, prompt: string): void {
	pi.sendMessage({ customType: PHASE_MARKER, content: "", display: false }, { triggerTurn: false });
	pi.sendUserMessage(prompt);
}

/**
 * FR-28 fresh context: keep only messages at/after the most recent phase marker,
 * dropping prior-phase chatter. The brainstorm loop is exempt (retains dialogue).
 * Returns the filtered messages array for the `context` event handler.
 */
export function filterContext(messages: unknown[], phase: Phase): unknown[] {
	if (phase === "BRAINSTORM") return messages; // retains the Q&A dialogue
	let lastMarker = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { customType?: string };
		if (m.customType === PHASE_MARKER) {
			lastMarker = i;
			break;
		}
	}
	if (lastMarker === -1) return messages;
	// Drop everything up to and including the marker (the marker itself is empty noise).
	return messages.slice(lastMarker + 1);
}

/** NFR-2: a creative step must have produced a non-empty artifact, else halt the phase. */
export async function artifactIsValid(pi: ExtensionAPI, path: string): Promise<boolean> {
	try {
		const r = await pi.exec("test", ["-s", path]); // -s: exists and size > 0
		return r.code === 0;
	} catch {
		return false;
	}
}
