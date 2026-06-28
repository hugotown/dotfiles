import { EXT_DIR } from "../config/resolve.ts";
import type { CommandResult, PiCommandApi } from "../types/command.ts";
import type { CommandCtx } from "../types/ports.ts";
import { continueRun, initConfig, showHelp, startNewRun } from "./actions.ts";
import { parseObraCommand } from "./parse.ts";

export async function handleObraCommand(
	args: string,
	ctx: CommandCtx,
	pi?: PiCommandApi,
	extDir = EXT_DIR,
): Promise<CommandResult> {
	const command = parseObraCommand(args);
	if (command.kind === "help") return showHelp(ctx);
	if (command.kind === "init") return initConfig(ctx, extDir);
	if (command.kind === "continue") return continueRun(ctx, extDir, command.selector);
	return startNewRun(ctx, pi, extDir, command.requirement);
}
