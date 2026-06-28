import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CommandCtx } from "../../src/types/ports.ts";

export interface MockCtx extends CommandCtx {
	notices: Array<{ text: string; level?: string }>;
	root: string;
}

export function makeMockCtx(): MockCtx {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "obra-cmd-"));
	const notices: MockCtx["notices"] = [];
	return {
		root,
		notices,
		cwd: root,
		hasUI: true,
		mode: "tui",
		sessionManager: { getSessionFile: () => path.join(root, "session.jsonl") },
		ui: {
			notify: (text, level) => notices.push({ text, level }),
			setStatus: () => undefined,
			setWidget: () => undefined,
			confirm: async () => true,
			select: async (_title, options) => options[0],
			input: async () => undefined,
		},
	};
}

export function cleanupCtx(ctx: MockCtx): void {
	fs.rmSync(ctx.root, { recursive: true, force: true });
}
