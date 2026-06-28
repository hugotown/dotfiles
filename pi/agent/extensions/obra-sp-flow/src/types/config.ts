/** Configuration shapes (config.yaml). */

/** Effective per-step LLM configuration. */
export interface StepConfig {
	model: string;
	thinkingLevel: string; // "" inherits defaults.thinkingLevel
	tools: string;
	skills: string[]; // paths passed to the child via --skill
	customInstructions: string[]; // injected into the step system prompt
	promptAppend: string; // extra system prompt text
}

export interface ObraConfig {
	version: number;
	defaults: {
		model: string;
		thinkingLevel: string;
		tools: string;
		skills: string[];
		llmRetries: number;
	};
	collectTree: { depth: number };
	// web-grounding mode: "quick" (ddg only) | "deep" (Brave API if BRAVE_SEARCH_API_KEY,
	// else ddg + Brave frontend scrape). All requests go through the DataImpulse proxy.
	webGrounding: { mode: string };
	brainstorm: { maxRounds: number; visualCompanion: boolean };
	spec: { toProject: boolean; projectDir: string; commit: boolean };
	steps: Record<string, Partial<StepConfig>>;
}
