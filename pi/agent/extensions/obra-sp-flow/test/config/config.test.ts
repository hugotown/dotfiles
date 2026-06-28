import { describe, expect, it } from "bun:test";
import { FALLBACK } from "../../src/config/defaults.ts";
import { deepMerge } from "../../src/config/merge.ts";
import { stepConfig } from "../../src/config/step.ts";

describe("merge + step", () => {
	it("deepMerge returns base when over is null", () => {
		expect(deepMerge(FALLBACK, null)).toBe(FALLBACK);
	});

	it("deepMerge overrides scalars and merges steps", () => {
		const merged = deepMerge(FALLBACK, {
			version: 2,
			defaults: { model: "m" } as any,
			steps: { build: { model: "x" } },
		});
		expect(merged.version).toBe(2);
		expect(merged.defaults.model).toBe("m");
		expect(merged.steps.build.model).toBe("x");
	});

	it("stepConfig falls back to defaults then overrides", () => {
		const base = stepConfig(FALLBACK, "missing");
		expect(base.model).toBe(FALLBACK.defaults.model);
		const cfg = deepMerge(FALLBACK, {
			steps: { a: { model: "z", skills: ["s"], customInstructions: ["c"], promptAppend: "p" } },
		});
		const s = stepConfig(cfg, "a");
		expect([s.model, s.skills[0], s.customInstructions[0], s.promptAppend]).toEqual(["z", "s", "c", "p"]);
	});
});
