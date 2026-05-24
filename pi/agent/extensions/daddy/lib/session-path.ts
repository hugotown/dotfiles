// State file path: <getSessionDir()>/<workflow>.daddy.json. We rely on pi's own
// session dir API so the path cannot drift if pi changes its encoding (design §12.1).
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { STATE_SUFFIX } from "../constants.ts";

export function stateFilePath(ctx: ExtensionContext, workflow: string): string {
	return path.join(ctx.sessionManager.getSessionDir(), `${workflow}${STATE_SUFFIX}`);
}
