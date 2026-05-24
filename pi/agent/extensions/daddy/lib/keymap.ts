// Keymap config: trigger gesture + in-panel navigation/editing keys, with built-in defaults.
// File loading lives in config.ts; this stays pure so it is easy to test.

export interface KeymapConfig {
	trigger: { key: string; windowMs: number };
	nav: {
		up: string[];
		down: string[];
		close: string[];
		mode: string[]; // toggle run <-> design
		add: string[]; // design: append a node
		delete: string[]; // design: remove selected node
		save: string[]; // design: write YAML
	};
}

export const DEFAULT_KEYMAP: KeymapConfig = {
	trigger: { key: "left", windowMs: 300 },
	nav: {
		up: ["up", "k"],
		down: ["down", "j"],
		close: ["escape", "q"],
		mode: ["tab"],
		add: ["a"],
		delete: ["d", "x"],
		save: ["s"],
	},
};

export function mergeKeymap(raw: Partial<KeymapConfig> | undefined): KeymapConfig {
	return {
		trigger: { ...DEFAULT_KEYMAP.trigger, ...raw?.trigger },
		nav: { ...DEFAULT_KEYMAP.nav, ...raw?.nav },
	};
}
