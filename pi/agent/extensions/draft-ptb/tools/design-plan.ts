// Tools: draft_ptb_completeness_check, draft_ptb_approaches, draft_ptb_design, draft_ptb_plan.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { DraftState, Approach, CompletenessResult } from "../state.ts";
import { transition } from "../reducer.ts";

type GetState = () => DraftState | null;
type SetState = (s: DraftState) => void;

function require(get: GetState): DraftState {
  const s = get();
  if (!s) throw new Error("No active draft-ptb workflow");
  return s;
}

export function registerDesignPlanTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "draft_ptb_completeness_check",
    label: "Draft: Completeness Check",
    description: "Decide whether understanding + answers are sufficient. If incomplete, return missingInfo items.",
    parameters: Type.Object({ complete: Type.Boolean(), missingInfo: Type.Array(Type.String()) }),
    async execute(_id, params) {
      const result: CompletenessResult = { complete: params.complete, missingInfo: params.missingInfo };
      set(transition(require(get), { type: "COMPLETENESS_CHECKED", result }));
      const label = params.complete ? "complete" : `incomplete (${params.missingInfo.length} gaps)`;
      return { content: [{ type: "text", text: `Completeness: ${label}.` }], details: null, terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_approaches",
    label: "Draft: Approaches",
    description: "Submit 2-3 implementation approaches with trade-offs.",
    parameters: Type.Object({
      approaches: Type.Array(Type.Object({ name: Type.String(), description: Type.String(), tradeoffs: Type.String() })),
      recommendation: Type.String(),
    }),
    async execute(_id, params) {
      set(transition(require(get), { type: "APPROACHES_RECEIVED", approaches: params.approaches as Approach[], recommendation: params.recommendation }));
      return { content: [{ type: "text", text: `${params.approaches.length} approaches proposed.` }], details: null, terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_design",
    label: "Draft: Design",
    description: "Submit the complete design spec in markdown.",
    parameters: Type.Object({ title: Type.String(), spec: Type.String() }),
    async execute(_id, params) {
      set(transition(require(get), { type: "SPEC_RECEIVED", title: params.title, spec: params.spec }));
      return { content: [{ type: "text", text: `Spec: "${params.title}"` }], details: null, terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_plan",
    label: "Draft: Plan",
    description: "Submit the complete implementation plan in markdown.",
    parameters: Type.Object({ plan: Type.String() }),
    async execute(_id, params) {
      set(transition(require(get), { type: "PLAN_RECEIVED", plan: params.plan }));
      return { content: [{ type: "text", text: "Plan received." }], details: null, terminate: true };
    },
  });
}
