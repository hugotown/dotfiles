/**
 * Artifact naming (group-aware).
 *
 * The 7 canonical milestone files live at `artifacts/NN-<milestone>.json` (NN = group 0..6).
 * Every non-milestone step writes its raw output under `artifacts/steps/NN-<id>.json`
 * (NN = global step index). Gate steps write no artifact (they persist to state.json only).
 */
import type { PhaseKind } from "../types/common.ts";

/** Group index (0..6) -> milestone slug used in NN-<slug>.json. */
export const MILESTONE_IDS: Record<number, string> = {
	0: "preflight",
	1: "design",
	2: "plan-contracts",
	3: "workspace",
	4: "execution",
	5: "branch-review",
	6: "close",
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Numbered milestone artifact for a canonical group (path relative to runDir). */
export function milestoneArtifactRel(group: number): string {
	const id = MILESTONE_IDS[group] ?? String(group);
	return `artifacts/${pad2(group)}-${id}.json`;
}

/** Per-step raw artifact (path relative to runDir). */
export function stepArtifactRel(seed: { index: number; id: string }): string {
	return `artifacts/steps/${pad2(seed.index)}-${seed.id}.json`;
}

export interface ArtifactSeed {
	index: number;
	id: string;
	group: number;
	kind: PhaseKind;
	milestone?: boolean;
}

/** Where a step's artifact lives, or null for gates (state-only). */
export function artifactRelForSeed(seed: ArtifactSeed): string | null {
	if (seed.kind === "gate") return null;
	return seed.milestone ? milestoneArtifactRel(seed.group) : stepArtifactRel(seed);
}
