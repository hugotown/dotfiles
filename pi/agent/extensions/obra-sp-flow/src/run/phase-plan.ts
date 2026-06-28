import type { PhaseKind } from "../types/common.ts";

/**
 * A step is the atomic unit of execution and per-step config (one PhaseKind each).
 * Steps are grouped into the 7 canonical milestones (`group` 0..6); each milestone
 * culminates in one numbered artifact (00-preflight.json .. 06-close.json).
 * Group 1 (Design) bundles several steps that all feed 01-design.json + design.md,
 * and `approval-gate` is the single, last human gate of the whole flow.
 */
export interface PhaseSeed {
	id: string;
	index: number; // global execution order
	kind: PhaseKind;
	group: number; // canonical milestone 0..6 (maps to the NN-*.json artifact)
	milestone?: boolean; // true => this step writes the group's NN-<milestone>.json
}

export const PHASE_PLAN: PhaseSeed[] = [
	// Group 0 — Pre-flight (no LLM) -> 00-preflight.json
	{ id: "preflight", index: 0, kind: "deterministic", group: 0, milestone: true },

	// Group 1 — Design -> 01-design.json + design.md (last human gate below)
	{ id: "collect-tree", index: 1, kind: "deterministic", group: 1 },
	{ id: "context-extract", index: 2, kind: "llm", group: 1 },
	{ id: "web-grounding", index: 3, kind: "llm", group: 1 },
	{ id: "brainstorm", index: 4, kind: "llm", group: 1 },
	{ id: "write-spec", index: 5, kind: "deterministic", group: 1, milestone: true },
	{ id: "spec-review", index: 6, kind: "llm", group: 1 },
	{ id: "approval-gate", index: 7, kind: "gate", group: 1 },

	// Group 2 — Plan + contracts -> 02-plan-contracts.json + plan.md
	{ id: "plan-contracts", index: 8, kind: "llm", group: 2, milestone: true },

	// Group 3 — Workspace / branch (no LLM) -> 03-workspace.json
	{ id: "workspace", index: 9, kind: "deterministic", group: 3, milestone: true },

	// Group 4 — Controlled parallel execution -> 04-execution.json
	{ id: "execution", index: 10, kind: "orchestrated", group: 4, milestone: true },

	// Group 5 — Branch review -> 05-branch-review.json
	{ id: "branch-review", index: 11, kind: "llm", group: 5, milestone: true },

	// Group 6 — Close-out (no LLM) -> 06-close.json
	{ id: "close", index: 12, kind: "deterministic", group: 6, milestone: true },
];
