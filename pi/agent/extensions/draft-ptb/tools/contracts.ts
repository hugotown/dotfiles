// Tools: draft_ptb_spec_with_surface, draft_ptb_plan_with_contracts.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { DraftState, TestSurface, FileContract, InfraTask, TestContract } from "../state.ts";
import { transition } from "../reducer.ts";

type GetState = () => DraftState | null;
type SetState = (s: DraftState) => void;

function require(get: GetState): DraftState {
  const s = get();
  if (!s) throw new Error("No active draft-ptb workflow");
  return s;
}

export function registerContractTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "draft_ptb_spec_with_surface",
    label: "Draft: Spec + Test Surface",
    description: "Submit spec markdown with structured test surface (journeys + integration boundaries).",
    parameters: Type.Object({
      title: Type.String(),
      spec: Type.String(),
      testSurface: Type.Object({
        journeys: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), steps: Type.Array(Type.String()), invariants: Type.Array(Type.String()) })),
        integrationBoundaries: Type.Array(Type.Object({ id: Type.String(), modules: Type.Array(Type.String()), invariants: Type.Array(Type.String()) })),
      }),
    }),
    async execute(_id, params) {
      const testSurface: TestSurface = params.testSurface;
      let next = transition(require(get), { type: "SPEC_RECEIVED", title: params.title, spec: params.spec });
      next = transition(next, { type: "TEST_SURFACE_RECEIVED", testSurface });
      set(next);
      const label = testSurface.journeys.length + testSurface.integrationBoundaries.length === 0
        ? "no test surface" : `${testSurface.journeys.length} journeys, ${testSurface.integrationBoundaries.length} boundaries`;
      return { content: [{ type: "text", text: `Spec: "${params.title}" (${label}).` }], details: null, terminate: true };
    },
  });

  pi.registerTool({
    name: "draft_ptb_plan_with_contracts",
    label: "Draft: Plan + Contracts",
    description: "Submit implementation plan with file contracts, shared files, infra task, and test contracts.",
    parameters: Type.Object({
      plan: Type.String(),
      fileContracts: Type.Array(Type.Object({
        path: Type.String(), purpose: Type.String(),
        exports: Type.Array(Type.Object({ name: Type.String(), signature: Type.String(), description: Type.String() })),
        imports: Type.Array(Type.String()), dependsOn: Type.Array(Type.String()),
      })),
      sharedFiles: Type.Array(Type.String()),
      infraTask: Type.Union([Type.Null(), Type.Object({ id: Type.String(), files: Type.Array(Type.String()), description: Type.String() })]),
      testContracts: Type.Array(Type.Object({
        path: Type.String(),
        kind: Type.Union([Type.Literal("workbook"), Type.Literal("playwright"), Type.Literal("integration")]),
        journey: Type.String(), codeContractsUnderTest: Type.Array(Type.String()),
      })),
    }),
    async execute(_id, params) {
      const fileContracts: FileContract[] = params.fileContracts;
      const infraTask: InfraTask | null = params.infraTask;
      const testContracts: TestContract[] = params.testContracts;
      let next = transition(require(get), { type: "PLAN_RECEIVED", plan: params.plan });
      next = transition(next, { type: "CONTRACTS_RECEIVED", fileContracts, sharedFiles: params.sharedFiles, infraTask, testContracts });
      set(next);
      return {
        content: [{ type: "text", text: `Plan received. ${fileContracts.length} contracts, ${params.sharedFiles.length} shared, infra=${infraTask ? "yes" : "no"}, tests=${testContracts.length}.` }],
        details: null, terminate: true,
      };
    },
  });
}
