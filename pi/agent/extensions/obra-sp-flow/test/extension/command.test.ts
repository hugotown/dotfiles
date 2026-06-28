import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import obraSpFlowExtension from "../../index.ts";
import { handleObraCommand } from "../../src/command/handler.ts";
import { registerObraSpFlow } from "../../src/extension/register.ts";
import type { CommandResult, PiCommandApi } from "../../src/types/command.ts";
import { cleanupCtx, makeMockCtx, type MockCtx } from "../helpers/mock-command.test.ts";

const contexts: MockCtx[] = [];
afterEach(() => contexts.splice(0).forEach(cleanupCtx));

function ctx(): MockCtx {
	const next = makeMockCtx();
	contexts.push(next);
	return next;
}

function registered(extDir?: string) {
	let handler!: (args: string, ctx: MockCtx) => Promise<CommandResult>;
	const pi: PiCommandApi = { registerCommand: (_name, opts) => (handler = opts.handler) };
	registerObraSpFlow(pi, extDir);
	return handler;
}

describe("obra-sp-flow extension command", () => {
	it("registers the slash command from the default export", () => {
		let name = "";
		obraSpFlowExtension({ registerCommand: (n) => void (name = n) } as PiCommandApi);
		expect(name).toBe("obra-sp-flow");
	});

	it("handles help, init, start and continue through the registered command", async () => {
		const c = ctx();
		const handler = registered(c.root);
		expect((await handler("--help", c)).kind).toBe("help");
		const init = await handler("--init", c);
		expect(init).toMatchObject({ kind: "init", created: true });
		expect(fs.existsSync(path.join(c.root, ".pi", "obra-sp-flow", "config.yaml"))).toBe(true);
		const start = await handler("crear flujo", c);
		if (start.kind !== "start") throw new Error("expected start result");
		expect(fs.existsSync(start.statePath)).toBe(true);
		expect((await handler("--continue", c)).kind).toBe("continue");
		const missing = await handler("--continue missing", c);
		if (missing.kind !== "continue") throw new Error("expected continue result");
		expect(missing.runId).toBeNull();
	});

	it("uses the handler default extension directory safely for help", async () => {
		const result = await handleObraCommand("", ctx());
		expect(result.kind).toBe("help");
	});
});
