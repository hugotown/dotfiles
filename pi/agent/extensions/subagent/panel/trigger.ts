// Installs the raw-input watcher that opens the panel on a qualifying double press.
// Consumes the key ONLY when: it completes a double press, there is no conversation,
// and at least one subagent is working. Otherwise the key passes through untouched.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { AppConfig } from "../lib/config.ts";
import { DoublePressDetector } from "../lib/double-press.ts";
import { editorIsEmpty } from "../lib/gate.ts";
import { hasWorkingSubagent } from "../lib/store.ts";
import { openPanel } from "./open.ts";

export function installTrigger(ctx: ExtensionContext, config: AppConfig): () => void {
	const detector = new DoublePressDetector(config.keymap.trigger.windowMs);
	let open = false;

	return ctx.ui.onTerminalInput((data) => {
		if (open) return undefined; // the overlay handles its own keys
		if (!matchesKey(data, config.keymap.trigger.key as KeyId)) return undefined;
		if (!detector.press(Date.now())) return undefined; // first press always passes through
		if (!editorIsEmpty(ctx) || !hasWorkingSubagent()) return undefined; // gate: idle editor + ≥1 working
		open = true;
		void openPanel(ctx, config.keymap, config.theme).finally(() => {
			open = false;
		});
		return { consume: true };
	});
}
