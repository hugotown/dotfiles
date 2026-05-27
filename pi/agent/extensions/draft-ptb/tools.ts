import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { DraftState, Answer, Approach } from "./state.ts";
import { transition } from "./reducer.ts";

type GetState = () => DraftState | null;
type SetState = (s: DraftState) => void;

function require(get: GetState): DraftState {
  const s = get();
  if (!s) throw new Error("No active draft-ptb workflow");
  return s;
}

export function registerTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "draft_ptb_research",
    label: "Draft: Research",
    description: "Submit Q&A pairs collected via ask_user_question.",
    parameters: Type.Object({ answers: Type.Array(Type.Object({
      question: Type.String(), answer: Type.String(),
    })) }),
    async execute(_id, params) {
      const s = require(get);
      set({ ...s, answers: params.answers as Answer[] });
      return { content: [{ type: "text", text: `Research: ${params.answers.length} answers.` }], terminate: true };
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
      return { content: [{ type: "text", text: `${params.approaches.length} approaches proposed.` }], terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_design",
    label: "Draft: Design",
    description: "Submit the complete design spec in markdown.",
    parameters: Type.Object({ title: Type.String(), spec: Type.String() }),
    async execute(_id, params) {
      set(transition(require(get), { type: "SPEC_RECEIVED", title: params.title, spec: params.spec }));
      return { content: [{ type: "text", text: `Spec: "${params.title}"` }], terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_plan",
    label: "Draft: Plan",
    description: "Submit the complete implementation plan in markdown.",
    parameters: Type.Object({ plan: Type.String() }),
    async execute(_id, params) {
      set(transition(require(get), { type: "PLAN_RECEIVED", plan: params.plan }));
      return { content: [{ type: "text", text: "Plan received." }], terminate: true };
    },
  });
}
