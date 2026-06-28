import type { ParsedCommand } from "../types/command.ts";

const CONTINUE = "--continue";

export function parseObraCommand(args: string): ParsedCommand {
	const text = args.trim();
	if (!text || text === "--help" || text === "-h") return { kind: "help" };
	if (text === "--init") return { kind: "init" };
	const isContinue = text === CONTINUE || text.startsWith(`${CONTINUE} `);
	if (!isContinue) return { kind: "start", requirement: text };

	const selector = text.slice(CONTINUE.length).trim();
	return selector ? { kind: "continue", selector } : { kind: "continue" };
}
