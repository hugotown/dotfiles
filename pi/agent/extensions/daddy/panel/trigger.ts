// Open the panel on a double-press of the trigger key. The raw onTerminalInput watcher is
// GLOBAL — it fires even when another extension owns an input overlay (e.g. gemini's image
// prompt). To avoid barging in there, the gate requires BOTH an idle main editor AND an
// active daddy run (mirrors subagent's hasWorkingSubagent gate). The gesture is for OBSERVING
// a run; design editing is reached explicitly via --daddy-design <name>.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { AppConfig } from "../lib/config.ts";
import { DoublePressDetector } from "../lib/double-press.ts";
import { editorIsEmpty } from "../lib/gate.ts";
import { hasActiveRun } from "../lib/store.ts";
import { openPanel } from "./open.ts";

export function installTrigger(ctx: ExtensionContext, config: AppConfig): () => void {
	const detector = new DoublePressDetector(config.keymap.trigger.windowMs);
	let open = false;

	return ctx.ui.onTerminalInput((data) => {
		if (open) return undefined; // the overlay handles its own keys
		if (!matchesKey(data, config.keymap.trigger.key as KeyId)) return undefined;
		if (!hasActiveRun()) return undefined; // never barge in when there is nothing to observe
		if (!detector.press(Date.now())) return undefined; // first press always passes through
		if (!editorIsEmpty(ctx)) return undefined; // gate: only when the main editor is idle
		open = true;
		void openPanel(ctx, config).finally(() => {
			open = false;
		});
		return { consume: true };
	});
}
