import { describe, expect, test } from "bun:test";
import { parseConfig } from "../lib/config.ts";
import { DEFAULT_KEYMAP } from "../lib/keymap.ts";
import { DEFAULT_THEME } from "../lib/theme.ts";

describe("parseConfig", () => {
	test("empty yaml yields keymap + theme defaults (Tokyo Night)", () => {
		const cfg = parseConfig("");
		expect(cfg.keymap).toEqual(DEFAULT_KEYMAP);
		expect(cfg.theme).toEqual(DEFAULT_THEME);
	});

	test("merges a partial theme over the Tokyo Night defaults", () => {
		const cfg = parseConfig('theme:\n  blue: "#000000"\n');
		expect(cfg.theme.blue).toBe("#000000");
		expect(cfg.theme.panelBg).toBe(DEFAULT_THEME.panelBg);
	});

	test("merges keymap under the keymap key", () => {
		const cfg = parseConfig("keymap:\n  trigger:\n    key: right\n    windowMs: 500\n");
		expect(cfg.keymap.trigger).toEqual({ key: "right", windowMs: 500 });
		expect(cfg.keymap.nav).toEqual(DEFAULT_KEYMAP.nav);
	});
});
