// Open the panel on a double-press of the trigger key, only when the editor is empty.
// onTerminalInput lives on ctx.ui (not pi), so this is installed from a context-bearing
// event in index.ts (mirrors subagent/panel/trigger.ts). The panel serves design AND run
// views, so the gate is just "editor empty" — it does NOT require an active run.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import { DoublePressDetector } from "../lib/double-press.ts";
import { editorIsEmpty } from "../lib/gate.ts";
import { openPanel } from "./open.ts";

const TRIGGER_KEY: KeyId = "left";
const WINDOW_MS = 300;

export function installTrigger(ctx: ExtensionContext): () => void {
	const detector = new DoublePressDetector(WINDOW_MS);
	let open = false;

	return ctx.ui.onTerminalInput((data) => {
		if (open) return undefined; // the overlay handles its own keys
		if (!matchesKey(data, TRIGGER_KEY)) return undefined;
		if (!detector.press(Date.now())) return undefined; // first press always passes through
		if (!editorIsEmpty(ctx)) return undefined; // gate: only when the editor is idle
		open = true;
		void openPanel(ctx).finally(() => {
			open = false;
		});
		return { consume: true };
	});
}
