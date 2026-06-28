import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { notifyOutcome, startNewRun } from "../../src/command/actions.ts";

const roots: string[] = [];
function tmpDir(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-act-"));
	roots.push(root);
	return root;
}
afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function fakeCtx(root: string, getSessionFile: () => string | undefined) {
	const notices: Array<{ text: string; level?: string }> = [];
	const ctx = {
		cwd: root,
		hasUI: true,
		mode: "tui",
		sessionManager: { getSessionFile },
		ui: {
			notify: (text: string, level?: string) => notices.push({ text, level }),
			setStatus: () => undefined,
			setWidget: () => undefined,
			confirm: async () => true,
			select: async () => undefined,
			input: async () => undefined,
		},
		waitForIdle: async () => undefined,
	} as never;
	return { ctx, notices };
}

describe("notifyOutcome", () => {
	function capture() {
		const notices: Array<{ text: string; level?: string }> = [];
		const ctx = { ui: { notify: (text: string, level?: string) => notices.push({ text, level }) } } as never;
		return { ctx, notices };
	}
	it("reports complete / paused / blocked outcomes", () => {
		const a = capture();
		notifyOutcome(a.ctx, { kind: "complete" });
		expect(a.notices[0].text).toContain("completada");
		expect(a.notices[0].level).toBe("info");

		const b = capture();
		notifyOutcome(b.ctx, { kind: "paused", phaseId: "approval-gate" });
		expect(b.notices[0].text).toContain("approval-gate");
		expect(b.notices[0].level).toBe("warning");

		const c = capture();
		notifyOutcome(c.ctx, { kind: "blocked", phaseId: "preflight", errors: ["boom"] });
		expect(c.notices[0].text).toContain("boom");
		expect(c.notices[0].level).toBe("warning");
	});
});

describe("startNewRun session enforcement", () => {
	it("blocks when no session can be anchored (no run is created)", async () => {
		const root = tmpDir();
		const { ctx, notices } = fakeCtx(root, () => undefined);
		// pi without sendMessage/sendUserMessage -> the forced turn cannot persist a session.
		const pi = { registerCommand: () => undefined } as never;

		const result = await startNewRun(ctx, pi, root, "crear flujo");

		expect(result.kind).toBe("blocked");
		expect(notices.some((n) => n.level === "error")).toBe(true);
	});

	it("creates the run when a real session is present", async () => {
		const root = tmpDir();
		const { ctx } = fakeCtx(root, () => path.join(root, "session.jsonl"));
		const pi = { registerCommand: () => undefined } as never;

		const result = await startNewRun(ctx, pi, root, "crear flujo");

		if (result.kind !== "start") throw new Error("expected start result");
		expect(fs.existsSync(result.statePath)).toBe(true);
	});
});
