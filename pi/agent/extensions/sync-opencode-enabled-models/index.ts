/**
 * sync-opencode-enabled-models — Pi extension entry point.
 *
 * Refreshes the `enabledModels` array in `~/.pi/agent/settings.json` so it
 * reflects the current list of available models exposed by the `opencode`
 * CLI for the `opencode` and `opencode-go` providers.
 *
 * IMPORTANT: this extension syncs MODEL IDENTIFIERS (e.g. "opencode-go/glm-5"),
 * not pricing, not credentials, not capabilities. It only updates which model
 * IDs are listed under `enabledModels` so newly-published models show up in
 * Pi's model picker without manual edits.
 *
 * EXECUTION MODEL:
 *   On `session_shutdown(reason="quit")` we spawn a DETACHED worker process
 *   (`bun worker.ts`) and return from the handler immediately. This is
 *   deliberate: Pi `await`s every session_shutdown handler before exiting
 *   (see pi-coding-agent/dist/core/extensions/runner.js:emitSessionShutdownEvent),
 *   so doing the sync inline would make `/quit` wait for two `opencode models`
 *   subprocess invocations plus a file write. The detached worker writes its
 *   stdout/stderr to a log file and survives Pi's exit.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const LOG_DIR = join(
  process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
  "sync-opencode-enabled-models",
);
const LOG_FILE = join(LOG_DIR, "worker.log");

function spawnDetachedWorker(): void {
  try {
    const scriptPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "worker.ts",
    );
    mkdirSync(LOG_DIR, { recursive: true });
    const fd = openSync(LOG_FILE, "a");
    const child = spawn("bun", [scriptPath], {
      detached: true,
      stdio: ["ignore", fd, fd],
      env: process.env,
      cwd: dirname(scriptPath),
    });
    child.unref();
  } catch (err) {
    // Swallow: failing to spawn must never block Pi shutdown. The error
    // will be invisible to the user, but it is the same trade-off as
    // agent-matrix-generator and matches the "no shutdown wait" contract.
    console.error(
      `[sync-opencode-enabled-models] failed to spawn detached worker: ${String(err)}`,
    );
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_shutdown", (event: { reason?: string }) => {
    if (event.reason !== "quit") return;
    spawnDetachedWorker();
  });
}
