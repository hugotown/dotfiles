import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type {
  DraftState,
  Approach,
  Understanding,
  Question,
  CompletenessResult,
  TestSurface,
  FileContract,
  InfraTask,
  TestContract,
} from "./state.ts";
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
    name: "draft_ptb_understanding",
    label: "Draft: Understanding",
    description:
      "Submit the structured deep understanding of the feature: user story, value, risks, existing solutions, " +
      "reusable components, assumptions, non-goals, scope check, test requirements, and open questions for the user.",
    parameters: Type.Object({
      userStory: Type.Object({
        when: Type.String(),
        given: Type.String(),
        then: Type.String(),
      }),
      why: Type.String(),
      value: Type.String(),
      risks: Type.Array(Type.String()),
      existingSolutions: Type.String(),
      reusableComponents: Type.String(),
      assumptions: Type.Array(Type.String()),
      nonGoals: Type.Array(Type.String()),
      scopeCheck: Type.Object({
        isDecomposable: Type.Boolean(),
        subProjects: Type.Array(Type.String()),
      }),
      testRequirements: Type.Object({
        wantsE2E: Type.Boolean(),
        wantsIntegration: Type.Boolean(),
        fields: Type.Array(Type.Object({
          name: Type.String(),
          type: Type.String(),
          source: Type.String(),
          validation: Type.String(),
        })),
        functionalRequirements: Type.Array(Type.Object({
          id: Type.String(),
          description: Type.String(),
          criteria: Type.Array(Type.String()),
        })),
        businessRules: Type.Array(Type.Object({
          id: Type.String(),
          description: Type.String(),
          scope: Type.String(),
        })),
      }),
      openQuestions: Type.Array(Type.Object({
        question: Type.String(),
        options: Type.Optional(Type.Array(Type.String())),
      })),
    }),
    async execute(_id, params) {
      const s = require(get);
      const understanding: Understanding = {
        userStory: params.userStory,
        why: params.why,
        value: params.value,
        risks: params.risks,
        existingSolutions: params.existingSolutions,
        reusableComponents: params.reusableComponents,
        assumptions: params.assumptions,
        nonGoals: params.nonGoals,
        scopeCheck: params.scopeCheck,
        testRequirements: params.testRequirements,
      };
      const openQuestions: Question[] = params.openQuestions;
      set(transition(s, { type: "UNDERSTANDING_RECEIVED", understanding, openQuestions }));
      return {
        content: [{ type: "text", text: `Understanding ready. ${openQuestions.length} open questions.` }],
        details: null,
        terminate: true,
      };
    },
  });

  pi.registerTool({
    name: "draft_ptb_completeness_check",
    label: "Draft: Completeness Check",
    description:
      "Decide whether the collected understanding + user answers are sufficient to design the feature. " +
      "If incomplete, return missingInfo items that will be asked next.",
    parameters: Type.Object({
      complete: Type.Boolean(),
      missingInfo: Type.Array(Type.String()),
    }),
    async execute(_id, params) {
      const s = require(get);
      const result: CompletenessResult = { complete: params.complete, missingInfo: params.missingInfo };
      set(transition(s, { type: "COMPLETENESS_CHECKED", result }));
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

  // M2 — spec + test surface in a single call.
  pi.registerTool({
    name: "draft_ptb_spec_with_surface",
    label: "Draft: Spec + Test Surface",
    description:
      "Submit the spec markdown together with the structured test surface (journeys + integration boundaries). " +
      "Pass an empty journeys/integrationBoundaries arrays when the user did not opt in for tests.",
    parameters: Type.Object({
      title: Type.String(),
      spec: Type.String(),
      testSurface: Type.Object({
        journeys: Type.Array(Type.Object({
          id: Type.String(),
          name: Type.String(),
          steps: Type.Array(Type.String()),
          invariants: Type.Array(Type.String()),
        })),
        integrationBoundaries: Type.Array(Type.Object({
          id: Type.String(),
          modules: Type.Array(Type.String()),
          invariants: Type.Array(Type.String()),
        })),
      }),
    }),
    async execute(_id, params) {
      const testSurface: TestSurface = params.testSurface;
      // Emit SPEC_RECEIVED first so handlers see spec + title together with surface ready.
      let next = transition(require(get), {
        type: "SPEC_RECEIVED",
        title: params.title,
        spec: params.spec,
      });
      next = transition(next, { type: "TEST_SURFACE_RECEIVED", testSurface });
      set(next);
      const surfaceLabel =
        testSurface.journeys.length + testSurface.integrationBoundaries.length === 0
          ? "no test surface"
          : `${testSurface.journeys.length} journeys, ${testSurface.integrationBoundaries.length} boundaries`;
      return {
        content: [{ type: "text", text: `Spec: "${params.title}" (${surfaceLabel}).` }],
        details: null,
        terminate: true,
      };
    },
  });

  // M2 — plan + file contracts + shared files + infra task + test contracts in a single call.
  pi.registerTool({
    name: "draft_ptb_plan_with_contracts",
    label: "Draft: Plan + Contracts",
    description:
      "Submit the complete implementation plan in markdown together with the structured file contracts, " +
      "the list of shared files, the optional infra task (single owner of shared files), and the test contracts.",
    parameters: Type.Object({
      plan: Type.String(),
      fileContracts: Type.Array(Type.Object({
        path: Type.String(),
        purpose: Type.String(),
        exports: Type.Array(Type.Object({
          name: Type.String(),
          signature: Type.String(),
          description: Type.String(),
        })),
        imports: Type.Array(Type.String()),
        dependsOn: Type.Array(Type.String()),
      })),
      sharedFiles: Type.Array(Type.String()),
      infraTask: Type.Union([
        Type.Null(),
        Type.Object({
          id: Type.String(),
          files: Type.Array(Type.String()),
          description: Type.String(),
        }),
      ]),
      testContracts: Type.Array(Type.Object({
        path: Type.String(),
        kind: Type.Union([
          Type.Literal("workbook"),
          Type.Literal("playwright"),
          Type.Literal("integration"),
        ]),
        journey: Type.String(),
        codeContractsUnderTest: Type.Array(Type.String()),
      })),
    }),
    async execute(_id, params) {
      const fileContracts: FileContract[] = params.fileContracts;
      const infraTask: InfraTask | null = params.infraTask;
      const testContracts: TestContract[] = params.testContracts;
      let next = transition(require(get), { type: "PLAN_RECEIVED", plan: params.plan });
      next = transition(next, {
        type: "CONTRACTS_RECEIVED",
        fileContracts,
        sharedFiles: params.sharedFiles,
        infraTask,
        testContracts,
      });
      set(next);
      return {
        content: [{
          type: "text",
          text:
            `Plan received. ${fileContracts.length} file contracts, ` +
            `${params.sharedFiles.length} shared files, ` +
            `infra=${infraTask ? "yes" : "no"}, tests=${testContracts.length}.`,
        }],
        details: null,
        terminate: true,
      };
    },
  });

  // M4 — review submission tools.
  //
  // Architecture note: reviewers run as child `pi` processes (--no-session). They have
  // no access to the parent workflow state, so these tools deliberately do NOT mutate
  // state. They exist to (a) satisfy the IMPLEMENTATION-CONTRACT.md tool list, (b) give
  // the child `pi` a schema-validated way to emit the review verdict as its final
  // assistant text. The parent dispatcher (review-dispatcher.ts) parses each child's
  // finalText as JSON and aggregates the three dimension results into the parent state
  // via the REVIEW_RAN event.
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

  const reviewTool = (name: string, label: string, dimension: string) => {
    pi.registerTool({
      name,
      label,
      description:
        `Submit the ${dimension} review verdict. Call exactly once as the final action of the ` +
        `review subagent. Returns the verdict as the agent's final text so the parent dispatcher ` +
        `can aggregate it.`,
      parameters: ReviewResultSchema,
      async execute(_id, params) {
        // Stateless: emit the JSON verdict so the parent dispatcher parses it from finalText.
        return {
          content: [{ type: "text", text: JSON.stringify(params) }],
          details: null,
          terminate: true,
        };
      },
    });
  };

  reviewTool("draft_ptb_review_contracts", "Draft: Review (contracts)", "contracts-compliance");
  reviewTool("draft_ptb_review_quality", "Draft: Review (quality)", "code-quality");
  reviewTool("draft_ptb_review_tests", "Draft: Review (tests)", "test-coverage");
}
