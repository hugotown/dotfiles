// tools/brainstorm-review.ts
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerBrainstormReview(pi: ExtensionAPI) {
  pi.registerTool({
    name: "brainstorm_review",
    label: "Brainstorm Review",
    description: "Deliver critical review findings of a design spec.",
    parameters: Type.Object({
      status: StringEnum(["pass", "issues_found"] as const),
      issues: Type.Array(
        Type.Object({
          id: Type.String(),
          section: Type.String(),
          severity: StringEnum(["high", "medium", "low"] as const),
          type: StringEnum([
            "contradiction",
            "ambiguity",
            "placeholder",
            "gap",
            "scope_creep",
          ] as const),
          description: Type.String(),
          suggestion: Type.String(),
        }),
      ),
      summary: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const issueCount = params.issues.length;
      return {
        content: [
          {
            type: "text" as const,
            text: `Review: ${params.status}. ${issueCount} issues found.`,
          },
        ],
        details: {
          status: params.status,
          issues: params.issues,
          summary: params.summary,
        },
        terminate: true,
      };
    },
  });
}
