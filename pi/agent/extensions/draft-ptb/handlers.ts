// Agent end handler — delegates to phase-specific sub-handlers.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState, DraftEvent } from "./state.ts";
import { handleResearchEnd, handleCompletenessEnd } from "./handlers-research.ts";
import { handleApproachesEnd, handleDesignEnd, handlePlanEnd } from "./handlers-design.ts";

export { APPROACHES_WIDGET_KEY } from "./handlers-design.ts";

type Advance = (ctx: ExtensionContext, event: DraftEvent) => Promise<void>;

export async function handleAgentEnd(
  state: DraftState, _pi: ExtensionAPI, ctx: ExtensionContext, advance: Advance,
): Promise<void> {
  switch (state.phase) {
    case "RESEARCH": return handleResearchEnd(state, ctx, advance);
    case "COMPLETENESS_CHECK": return handleCompletenessEnd(state, ctx, advance);
    case "APPROACHES": return handleApproachesEnd(state, ctx, advance);
    case "DESIGN": return handleDesignEnd(state, ctx, advance);
    case "PLAN": return handlePlanEnd(state, ctx, advance);
  }
}
