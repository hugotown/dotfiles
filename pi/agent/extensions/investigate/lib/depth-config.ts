import type { DepthLevel, DepthProfile, InvestigateConfig } from "../types.ts";

export function resolveDepth(config: InvestigateConfig, depth: DepthLevel): DepthProfile {
  const profile = config.depths[depth];
  if (!profile) throw new Error(`Unknown depth "${depth}". Valid: light|medium|high|deep.`);
  return { ...profile, planner: { ...profile.planner }, investigator: { ...profile.investigator }, synthesizer: { ...profile.synthesizer } };
}
