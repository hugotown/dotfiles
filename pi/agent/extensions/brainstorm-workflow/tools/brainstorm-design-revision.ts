// tools/brainstorm-design-revision.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormDesignRevision(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_design_revision",
    label: "Brainstorm Design Revision",
    description: "Deliver a revised section of the design.",
    parameters: Type.Object({
      section_id: Type.String(),
      content: Type.String({ description: "Revised section content in markdown" }),
      wireframe: Type.Optional(
        Type.Object({
          description: Type.String(),
          lines: Type.Array(Type.String()),
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Section "${params.section_id}" revised.`,
          },
        ],
        details: {
          section_id: params.section_id,
          content: params.content,
          wireframe: params.wireframe,
        },
        terminate: true,
      };
    },
  });
}
