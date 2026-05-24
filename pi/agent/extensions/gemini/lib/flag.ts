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

export function registerFlag(pi: ExtensionAPI, spec: FlagSpec): void {
  const flag = `--${spec.token}`;
  pi.registerFlag(spec.token, { description: spec.description, type: "string" });
  pi.events.emit("flag:registered", { token: flag, description: spec.description });

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
