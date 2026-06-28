/** Pure config merge helpers (project yaml merged over global over fallback). */
import type { ObraConfig, StepConfig } from "../types/config.ts";

function mergeSteps(
	base: Record<string, Partial<StepConfig>> | undefined,
	over: Record<string, Partial<StepConfig>> | undefined,
): Record<string, Partial<StepConfig>> {
	const out: Record<string, Partial<StepConfig>> = {};
	for (const [k, v] of Object.entries(base ?? {})) out[k] = { ...v };
	for (const [k, v] of Object.entries(over ?? {})) out[k] = { ...(out[k] ?? {}), ...(v ?? {}) };
	return out;
}

export function deepMerge(base: ObraConfig, over: Partial<ObraConfig> | null): ObraConfig {
	if (!over) return base;
	return {
		version: over.version ?? base.version,
		defaults: { ...base.defaults, ...(over.defaults ?? {}) },
		collectTree: { ...base.collectTree, ...(over.collectTree ?? {}) },
		webGrounding: { ...base.webGrounding, ...(over.webGrounding ?? {}) },
		brainstorm: { ...base.brainstorm, ...(over.brainstorm ?? {}) },
		spec: { ...base.spec, ...(over.spec ?? {}) },
		steps: mergeSteps(base.steps, over.steps as Record<string, Partial<StepConfig>>),
	};
}
