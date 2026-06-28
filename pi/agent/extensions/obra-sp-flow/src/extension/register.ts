import { EXT_DIR } from "../config/resolve.ts";
import { handleObraCommand } from "../command/handler.ts";
import type { PiCommandApi } from "../types/command.ts";

export function registerObraSpFlow(pi: PiCommandApi, extDir = EXT_DIR): void {
	pi.registerCommand("obra-sp-flow", {
		description: "Context extract → brainstorm → spec harness",
		handler: (args, ctx) => handleObraCommand(args, ctx, pi, extDir),
	});
}
