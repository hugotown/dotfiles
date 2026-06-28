/** Resolve the effective configuration of a single step. */
import type { ObraConfig, StepConfig } from "../types/config.ts";

export function stepConfig(config: ObraConfig, stepId: string): StepConfig {
	const s = config.steps[stepId] ?? {};
	return {
		model: s.model || config.defaults.model || "",
		thinkingLevel: s.thinkingLevel || config.defaults.thinkingLevel || "",
		tools: s.tools || config.defaults.tools || "read,grep,find,ls,bash",
		skills: Array.isArray(s.skills) ? s.skills : (config.defaults.skills ?? []),
		customInstructions: Array.isArray(s.customInstructions) ? s.customInstructions : [],
		promptAppend: s.promptAppend ?? "",
	};
}
