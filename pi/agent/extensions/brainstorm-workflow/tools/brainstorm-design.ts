// tools/brainstorm-design.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormDesign(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_design",
    label: "Brainstorm Design",
    description:
      "Deliver a complete design structured in reviewable sections. Each section is self-contained.",
    parameters: Type.Object({
      title: Type.String({ description: "Design title" }),
      sections: Type.Array(
        Type.Object({
          id: Type.String(),
          title: Type.String(),
          content: Type.String({ description: "Section content in markdown" }),
          wireframe: Type.Optional(
            Type.Object({
              description: Type.String(),
              lines: Type.Array(Type.String()),
            }),
          ),
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const sectionCount = params.sections.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Design "${params.title}" with ${sectionCount} sections delivered.`,
          },
        ],
        details: {
          title: params.title,
          sections: params.sections,
        },
        terminate: true,
      };
    },
  });
}
