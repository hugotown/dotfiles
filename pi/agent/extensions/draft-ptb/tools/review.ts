// Tools: draft_ptb_review_contracts, draft_ptb_review_quality, draft_ptb_review_tests.
// Stateless submission tools for reviewer subagents.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerReviewTools(pi: ExtensionAPI): void {
  const ReviewIssueSchema = Type.Object({
    severity: Type.Union([Type.Literal("critical"), Type.Literal("important"), Type.Literal("minor")]),
    file: Type.String(),
    line: Type.Union([Type.Null(), Type.Integer()]),
    description: Type.String(),
    fixSuggestion: Type.String(),
  });
  const ReviewResultSchema = Type.Object({
    approved: Type.Boolean(),
    issues: Type.Array(ReviewIssueSchema),
  });

  const register = (name: string, label: string, dimension: string) => {
    pi.registerTool({
      name, label,
      description: `Submit the ${dimension} review verdict. Call exactly once as the final action.`,
      parameters: ReviewResultSchema,
      async execute(_id, params) {
        return { content: [{ type: "text", text: JSON.stringify(params) }], details: null, terminate: true };
      },
    });
  };

  register("draft_ptb_review_contracts", "Draft: Review (contracts)", "contracts-compliance");
  register("draft_ptb_review_quality", "Draft: Review (quality)", "code-quality");
  register("draft_ptb_review_tests", "Draft: Review (tests)", "test-coverage");
}
