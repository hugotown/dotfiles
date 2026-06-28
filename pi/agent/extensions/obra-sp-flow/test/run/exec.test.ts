import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { makeExec } from "../../src/run/exec.ts";
import { nodeSpawn, type SpawnChild, type SpawnFn } from "../../src/run/spawn.ts";

function fakeChild(): { proc: SpawnChild & EventEmitter; stdout: EventEmitter; stderr: EventEmitter } {
	const stdout = new EventEmitter();
	const stderr = new EventEmitter();
	const proc = new EventEmitter() as EventEmitter & SpawnChild;
	(proc as { stdout: unknown }).stdout = stdout;
	(proc as { stderr: unknown }).stderr = stderr;
	proc.killed = false;
	proc.kill = () => {
		proc.killed = true;
		proc.emit("close", null);
		return true;
	};
	return { proc, stdout, stderr };
}

describe("makeExec", () => {
	it("runs a real command and captures stdout + exit code (nodeSpawn)", async () => {
		const r = await makeExec(nodeSpawn, process.cwd())("echo", ["hi"]);
		expect(r.code).toBe(0);
		expect(r.stdout.trim()).toBe("hi");
		expect(r.killed).toBe(false);
	});

	it("reports a missing binary via the error path (code null)", async () => {
		const r = await makeExec(nodeSpawn)("obra-no-such-cmd-zzz", []);
		expect(r.code).toBeNull();
		expect(r.stderr).not.toBe("");
	});

	it("resolves with code null when spawn throws synchronously", async () => {
		const fn: SpawnFn = () => {
			throw new Error("spawn nope");
		};
		const r = await makeExec(fn)("x", []);
		expect(r.code).toBeNull();
		expect(r.stderr).toContain("spawn nope");
	});

	it("appends the error to prior stderr on an async error", async () => {
		const fn: SpawnFn = () => {
			const { proc, stderr } = fakeChild();
			setImmediate(() => {
				stderr.emit("data", Buffer.from("warn"));
				proc.emit("error", new Error("boom"));
			});
			return proc;
		};
		const r = await makeExec(fn)("x", []);
		expect(r.code).toBeNull();
		expect(r.stderr).toContain("warn");
		expect(r.stderr).toContain("boom");
	});

	it("hard-kills on timeout and flags killed", async () => {
		const fn: SpawnFn = () => fakeChild().proc; // never closes on its own
		const r = await makeExec(fn)("sleep", ["10"], { timeout: 5 });
		expect(r.killed).toBe(true);
		expect(r.code).toBeNull();
	});
});
