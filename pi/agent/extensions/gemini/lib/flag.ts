/**
 * DRY flag registration. Every module exposes a `--gemini-<x>` flag that is
 * intercepted BEFORE the LLM. This wires registerFlag + autocomplete + input
 * handling once; modules supply only their token and a handler.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface FlagSpec {
  /** Token without leading dashes, e.g. "gemini-google-search". */
  token: string;
  description: string;
  /** Receives the prompt text with the flag stripped, plus the live context. */
  handle: (prompt: string, ctx: ExtensionContext) => Promise<void>;
}

/**
 * In-package map `--gemini-<x>` → its handler. Populated by registerFlag and read by
 * the TAB trigger (panel/trigger.ts) to open the right form when the editor text ends
 * with a flag. This is an intra-package share, NOT a cross-extension import.
 */
export const flagHandlers = new Map<string, FlagSpec["handle"]>();

export function registerFlag(pi: ExtensionAPI, spec: FlagSpec): void {
  const flag = `--${spec.token}`;
  flagHandlers.set(flag, spec.handle);
  pi.registerFlag(spec.token, { description: spec.description, type: "string" });
  // Announce on session_start (not at load): the bus has no replay, so emitting at
  // load misses consumers that load later (e.g. subagent). By session_start every
  // extension is subscribed. See extensions/README.md "Flag registration".
  pi.on("session_start", () => {
    pi.events.emit("flag:registered", { token: flag, description: spec.description });
  });

  pi.on("input", async (event, ctx) => {
    if (!event.text.includes(flag)) return { action: "continue" };
    const prompt = event.text.split(flag).join("").trim();
    if (!ctx.hasUI) {
      ctx.ui.notify(`${flag} requires an interactive UI.`, "error");
      return { action: "handled" };
    }
    try {
      await spec.handle(prompt, ctx);
    } catch (err) {
      ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
    }
    return { action: "handled" };
  });
}
