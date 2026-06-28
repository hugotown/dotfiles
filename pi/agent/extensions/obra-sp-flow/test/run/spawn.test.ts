import { describe, expect, it } from "bun:test";
import { getPiInvocation } from "../../src/run/spawn.ts";

describe("getPiInvocation", () => {
	it("reuses the current script + runtime when it exists", () => {
		const inv = getPiInvocation(["--mode", "json"], {
			argv1: "/abs/pi.js",
			execPath: "/usr/bin/bun",
			exists: () => true,
		});
		expect(inv.command).toBe("/usr/bin/bun");
		expect(inv.args).toEqual(["/abs/pi.js", "--mode", "json"]);
	});

	it("falls back to `pi` on a generic runtime when the script is unusable", () => {
		const inv = getPiInvocation(["x"], {
			argv1: "/$bunfs/root/pi",
			execPath: "/usr/local/bin/bun",
			exists: () => false,
		});
		expect(inv.command).toBe("pi");
		expect(inv.args).toEqual(["x"]);
	});

	it("uses the execPath directly on a non-generic runtime with no script", () => {
		const inv = getPiInvocation(["x"], {
			argv1: undefined,
			execPath: "/opt/pi/pi",
			exists: () => false,
		});
		expect(inv.command).toBe("/opt/pi/pi");
		expect(inv.args).toEqual(["x"]);
	});

	it("resolves with real process defaults when no env is given", () => {
		const inv = getPiInvocation(["x"]);
		expect(typeof inv.command).toBe("string");
		expect(inv.args[inv.args.length - 1]).toBe("x");
	});
});
