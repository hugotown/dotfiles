// tools/brainstorm-approaches.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormApproaches(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_approaches",
    label: "Brainstorm Approaches",
    description:
      "Deliver 2-3 design approaches with tradeoffs, effort/risk assessment, optional wireframes, and a recommendation.",
    parameters: Type.Object({
      approaches: Type.Array(
        Type.Object({
          id: Type.String(),
          title: Type.String(),
          summary: Type.String(),
          pros: Type.Array(Type.String()),
          cons: Type.Array(Type.String()),
          effort: StringEnum(["low", "medium", "high"] as const),
          risk: StringEnum(["low", "medium", "high"] as const),
          wireframe: Type.Optional(
            Type.Object({
              description: Type.String(),
              lines: Type.Array(Type.String()),
            }),
          ),
        }),
      ),
      recommendation: Type.String(),
      recommendation_reasoning: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const count = params.approaches.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Proposed ${count} approaches. Recommended: ${params.recommendation}`,
          },
        ],
        details: {
          approaches: params.approaches,
          recommendation: params.recommendation,
          recommendation_reasoning: params.recommendation_reasoning,
        },
        terminate: true,
      };
    },
  });
}
