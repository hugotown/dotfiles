// Tool registration entry point. Wires all sub-module tools.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "../state.ts";
import { registerUnderstandingTool } from "./understanding.ts";
import { registerDesignPlanTools } from "./design-plan.ts";
import { registerContractTools } from "./contracts.ts";
import { registerReviewTools } from "./review.ts";

type GetState = () => DraftState | null;
type SetState = (s: DraftState) => void;

export function registerTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  registerUnderstandingTool(pi, get, set);
  registerDesignPlanTools(pi, get, set);
  registerContractTools(pi, get, set);
  registerReviewTools(pi);
}
