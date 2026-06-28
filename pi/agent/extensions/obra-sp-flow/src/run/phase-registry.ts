/** Maps a step id to its concrete Phase implementation. */
import { collectTreePhase } from "../phases/collect-tree.ts";
import { contextExtractPhase } from "../phases/context-extract.ts";
import { preflightPhase } from "../phases/preflight.ts";
import type { Phase } from "../types/phase.ts";

export type PhaseRegistry = Record<string, Phase>;

/**
 * Concrete phases are plugged in as later steps build them (Phase 0..6).
 * Unregistered steps make the executor halt with a clear "not implemented yet"
 * message instead of silently skipping them.
 */
export const DEFAULT_REGISTRY: PhaseRegistry = {
	preflight: preflightPhase,
	"collect-tree": collectTreePhase,
	"context-extract": contextExtractPhase,
};
