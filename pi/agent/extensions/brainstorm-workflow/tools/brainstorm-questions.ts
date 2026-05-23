// tools/brainstorm-questions.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormQuestions(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_questions",
    label: "Brainstorm Questions",
    description:
      "Deliver structured research findings: assumptions inferred from context and strategic questions for the user. Set done=true when enough info gathered to propose approaches.",
    parameters: Type.Object({
      done: Type.Boolean({ description: "True if enough info to propose approaches" }),
      assumptions: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            text: Type.String(),
            confidence: StringEnum(["high", "medium", "low"] as const),
          }),
        ),
      ),
      questions: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            label: Type.String(),
            type: StringEnum(["select", "text"] as const),
            options: Type.Optional(Type.Array(Type.String())),
            default: Type.String(),
            reasoning: Type.String(),
          }),
        ),
      ),
    }),
    async execute(_toolCallId, params) {
      const assumptionCount = params.assumptions?.length ?? 0;
      const questionCount = params.questions?.length ?? 0;
      return {
        content: [
          {
            type: "text" as const,
            text: `Delivered ${assumptionCount} assumptions and ${questionCount} questions. Done: ${params.done}`,
          },
        ],
        details: {
          done: params.done,
          assumptions: params.assumptions ?? [],
          questions: params.questions ?? [],
        },
        terminate: true,
      };
    },
  });
}
