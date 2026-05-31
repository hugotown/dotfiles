// Tool: draft_ptb_understanding — submit structured deep understanding.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { DraftState, Understanding, Question } from "../state.ts";
import { transition } from "../reducer.ts";

type GetState = () => DraftState | null;
type SetState = (s: DraftState) => void;

function require(get: GetState): DraftState {
  const s = get();
  if (!s) throw new Error("No active draft-ptb workflow");
  return s;
}

export function registerUnderstandingTool(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "draft_ptb_understanding",
    label: "Draft: Understanding",
    description:
      "Submit the structured deep understanding of the feature: user story, value, risks, existing solutions, " +
      "reusable components, assumptions, non-goals, scope check, test requirements, and open questions for the user.",
    parameters: Type.Object({
      userStory: Type.Object({ when: Type.String(), given: Type.String(), then: Type.String() }),
      why: Type.String(),
      value: Type.String(),
      risks: Type.Array(Type.String()),
      existingSolutions: Type.String(),
      reusableComponents: Type.String(),
      assumptions: Type.Array(Type.String()),
      nonGoals: Type.Array(Type.String()),
      scopeCheck: Type.Object({ isDecomposable: Type.Boolean(), subProjects: Type.Array(Type.String()) }),
      testRequirements: Type.Object({
        wantsE2E: Type.Boolean(),
        wantsIntegration: Type.Boolean(),
        fields: Type.Array(Type.Object({ name: Type.String(), type: Type.String(), source: Type.String(), validation: Type.String() })),
        functionalRequirements: Type.Array(Type.Object({ id: Type.String(), description: Type.String(), criteria: Type.Array(Type.String()) })),
        businessRules: Type.Array(Type.Object({ id: Type.String(), description: Type.String(), scope: Type.String() })),
      }),
      openQuestions: Type.Array(Type.Object({ question: Type.String(), options: Type.Optional(Type.Array(Type.String())) })),
    }),
    async execute(_id, params) {
      const s = require(get);
      const understanding: Understanding = {
        userStory: params.userStory, why: params.why, value: params.value, risks: params.risks,
        existingSolutions: params.existingSolutions, reusableComponents: params.reusableComponents,
        assumptions: params.assumptions, nonGoals: params.nonGoals,
        scopeCheck: params.scopeCheck, testRequirements: params.testRequirements,
      };
      const openQuestions: Question[] = params.openQuestions;
      set(transition(s, { type: "UNDERSTANDING_RECEIVED", understanding, openQuestions }));
      return { content: [{ type: "text", text: `Understanding ready. ${openQuestions.length} open questions.` }], details: null, terminate: true };
    },
  });
}
