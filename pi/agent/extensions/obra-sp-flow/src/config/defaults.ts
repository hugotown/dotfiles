/** Built-in fallback configuration (used when no yaml is present). */
import type { ObraConfig } from "../types/config.ts";

/** Directory name pi uses for project config (kept local to avoid a runtime dep). */
export const CONFIG_DIR_NAME = ".pi";

export const FALLBACK: ObraConfig = {
	version: 1,
	defaults: {
		model: "openai-codex/gpt-5.4",
		thinkingLevel: "high",
		tools: "read,grep,find,ls,bash,write,edit",
		skills: [],
		llmRetries: 2,
	},
	collectTree: { depth: 5 },
	webGrounding: { mode: "deep" },
	brainstorm: { maxRounds: 0, visualCompanion: true },
	spec: { toProject: false, projectDir: "docs/superpowers/specs", commit: false },
	steps: {},
};
