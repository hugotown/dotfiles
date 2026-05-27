// Opens the form panel on the trigger key (default TAB) when the editor text ENDS WITH
// a registered `--gemini-*` flag. Otherwise the key passes through untouched so normal
// flag/file autocompletion still works. Mirrors subagent's onTerminalInput watcher.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type KeyId, matchesKey } from "@earendil-works/pi-tui";
import { flagHandlers } from "../lib/flag";
import { getConfig } from "../lib/settings";

/** Longest registered flag the trimmed editor text ends with (whole-token match). */
function matchFlag(text: string): string | undefined {
  return [...flagHandlers.keys()]
    .filter((f) => text === f || text.endsWith(` ${f}`))
    .sort((a, b) => b.length - a.length)[0];
}

export function installFlagPanelTrigger(ctx: ExtensionContext): () => void {
  const { keymap } = getConfig();
  let open = false;
  return ctx.ui.onTerminalInput((data) => {
    if (open) return undefined; // the overlay owns its keys while shown
    if (!matchesKey(data, keymap.trigger.key as KeyId)) return undefined;
    const text = ctx.ui.getEditorText().trimEnd();
    const flag = matchFlag(text);
    if (!flag) return undefined; // not a complete gemini flag → let autocomplete handle TAB
    const handle = flagHandlers.get(flag);
    if (!handle) return undefined;

    const prompt = text.split(flag).join("").trim();
    ctx.ui.setEditorText(""); // the flag is consumed; its text is carried into the panel
    open = true;
    void Promise.resolve(handle(prompt, ctx))
      .catch((err) => ctx.ui.notify(err instanceof Error ? err.message : String(err), "error"))
      .finally(() => { open = false; });
    return { consume: true };
  });
}
