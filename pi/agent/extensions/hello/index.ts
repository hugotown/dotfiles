// hello — typing `--hello` in the chat short-circuits the main LLM and instead
// runs an isolated `pi` subagent instructed to reply only with "world".
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runWorldSubagent } from "./subagent.ts";

const FLAG = "--hello";
const MESSAGE_TYPE = "hello-world";
const FLAG_DESCRIPTION = "Reply only with 'world' via an isolated subagent (no thinking, no actions)";

export default function hello(pi: ExtensionAPI): void {
  // Register the flag so it shows up in --help.
  pi.registerFlag("hello", { description: FLAG_DESCRIPTION, type: "boolean" });

  // Announce it on the shared event bus so flag-aware extensions (autocomplete,
  // subagent interception notices) know about `--hello`. Emit on session_start, not
  // at load: the bus has no replay, so emitting at load misses any consumer that
  // loads after us. By session_start every extension is loaded and subscribed.
  pi.on("session_start", () => {
    pi.events.emit("flag:registered", { token: FLAG, description: FLAG_DESCRIPTION });
  });

  pi.on("input", async (event, ctx) => {
    if (!event.text.includes(FLAG)) return { action: "continue" };

    // Strip the flag; whatever remains becomes the subagent's prompt (so a nested
    // child never sees "--hello" again — no recursion).
    const prompt = event.text.split(FLAG).join("").trim();

    // Works headless too (e.g. inside another subagent): runWorldSubagent only
    // spawns a child process, it needs no UI. The status notify is UI-only.
    if (ctx.hasUI) ctx.ui.notify("Running hello subagent…", "info");
    try {
      const answer = await runWorldSubagent(prompt, ctx.cwd);
      // Emitted as a custom message_end. In a headless subagent this is what the
      // parent `subagent` tool captures as this agent's output.
      pi.sendMessage({ customType: MESSAGE_TYPE, content: answer, display: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (ctx.hasUI) ctx.ui.notify(msg, "error");
      else pi.sendMessage({ customType: MESSAGE_TYPE, content: `error: ${msg}`, display: true });
    }

    // The main agent never sees the message — no LLM turn is triggered.
    return { action: "handled" };
  });
}
