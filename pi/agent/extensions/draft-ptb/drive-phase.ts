// Phase router — delegates to focused sub-modules by phase.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { driveGatheringContext, driveResearch, driveCompleteness, driveApproaches, driveDesign, drivePlan } from "./drive/llm-phases.ts";
import { driveParallelImpl, driveTestGen, driveChecks, driveReview, driveIterateOrShip } from "./drive/exec-phases.ts";
import { driveComplete, driveIdle } from "./drive/terminal-phases.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function driveCurrentPhase(
  state: DraftState, pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "GATHERING_CONTEXT": return driveGatheringContext(state, pi, ctx, advance);
    case "RESEARCH": return driveResearch(state, pi, ctx, advance);
    case "COMPLETENESS_CHECK": return driveCompleteness(pi, ctx, state, advance);
    case "APPROACHES": return driveApproaches(pi, ctx, advance, state);
    case "DESIGN": return driveDesign(pi, ctx, advance, state);
    case "PLAN": return drivePlan(pi, ctx, advance, state);
    case "PARALLEL_IMPLEMENTATION": return driveParallelImpl(state, pi, ctx, advance);
    case "TEST_GENERATION": return driveTestGen(state, pi, ctx, advance);
    case "DETERMINISTIC_CHECKS": return driveChecks(state, pi, ctx, advance);
    case "LLM_REVIEW": return driveReview(state, pi, ctx, advance);
    case "ITERATE_OR_SHIP": return driveIterateOrShip(state, pi, ctx, advance);
    case "COMPLETE": return driveComplete(state, pi, ctx);
    case "IDLE": return driveIdle(state, pi, ctx);
  }
}
